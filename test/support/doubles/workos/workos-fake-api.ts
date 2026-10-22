import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { TestContext } from 'node:test';
import { WorkOS } from '@workos-inc/node';
import type { SigningKey } from './jwt-signing-key.ts';

export const fakeApiKey = 'sk_test_fake';
export const fakeClientId = 'client_test';
export const cookiePassword = 'magumagu-test-cookie-password-0123456789';

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly authorization: string | undefined;
  readonly idempotencyKey: string | undefined;
  readonly ifMatch: string | undefined;
}

interface FakeResponse {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export type FakeAnswer = FakeResponse | 'hang' | 'close';
type Responder = FakeAnswer | ((request: RecordedRequest) => FakeAnswer | Promise<FakeAnswer>);
// A responder for the requests of a route pattern. It gets the path segment of the ID, decoded.
type IdResponder = (request: RecordedRequest, id: string) => FakeAnswer | Promise<FakeAnswer>;

interface PatternRoute {
  readonly segments: readonly string[];
  readonly responder: IdResponder;
}

const idSegment = ':id';

class KeySetEndpoint {
  #keys: readonly SigningKey[] = [];
  #outage: FakeAnswer | undefined;

  publish(...keys: SigningKey[]): void {
    this.#keys = [...this.#keys, ...keys];
  }

  withdraw(key: SigningKey): void {
    this.#keys = this.#keys.filter((published) => published !== key);
  }

  breakWith(outage: FakeAnswer): void {
    this.#outage = outage;
  }

  answer(): FakeAnswer {
    return this.#outage ?? { status: 200, body: { keys: this.#keys.map(({ publicJwk }) => publicJwk) } };
  }
}

export class WorkOSFakeApi {
  readonly origin: string;
  readonly port: number;
  readonly browserKeySet = new KeySetEndpoint();
  readonly authkitKeySet = new KeySetEndpoint();
  readonly #responders = new Map<string, Responder>();
  readonly #patternRoutes: PatternRoute[] = [];
  #requests: RecordedRequest[] = [];

  private constructor(port: number) {
    this.port = port;
    this.origin = `http://127.0.0.1:${port}`;
    this.answer(`GET /sso/jwks/${fakeClientId}`, () => this.browserKeySet.answer());
    this.answer('GET /authkit/oauth2/jwks', () => this.authkitKeySet.answer());
  }

  static async start(t: TestContext): Promise<WorkOSFakeApi> {
    const server = createServer();
    const port = await listenOnLoopback(server);
    t.after(() => closeServer(server));
    const fake = new WorkOSFakeApi(port);
    server.on('request', (request: IncomingMessage, response: ServerResponse) => {
      // A client can abort while the fake reads the body. That request then gets no answer.
      fake.#serve(request, response).catch(() => response.destroy());
    });
    return fake;
  }

  get browserIssuer(): string {
    return `${this.origin}/user_management/${fakeClientId}`;
  }

  get authkitIssuer(): string {
    return `${this.origin}/authkit`;
  }

  get authkitKeySetUrl(): URL {
    return new URL(`${this.authkitIssuer}/oauth2/jwks`);
  }

  answer(methodAndPath: string, responder: Responder): void {
    this.#responders.set(methodAndPath, responder);
  }

  intercept(methodAndPath: string, handler: (request: RecordedRequest, respond: () => Promise<FakeAnswer>) => FakeAnswer | Promise<FakeAnswer>): void {
    const responder = this.#responders.get(methodAndPath);
    if (responder === undefined) throw new Error(`No exact responder for ${methodAndPath}`);
    this.answer(methodAndPath, (request) => handler(request, async () => typeof responder === 'function' ? responder(request) : responder));
  }

  // Answers each request that fits a method and a path with one ":id" segment, for example
  // 'GET /user_management/users/:id'. A route of answer() for the exact path comes first.
  answerEach(methodAndPattern: string, responder: IdResponder): void {
    this.#patternRoutes.push({ segments: methodAndPattern.split('/'), responder });
  }

  takeRequests(): RecordedRequest[] {
    const requests = this.#requests;
    this.#requests = [];
    return requests;
  }

  async #serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const recorded = await recordedRequest(request);
    this.#requests.push(recorded);
    const route = `${recorded.method} ${recorded.path.split('?')[0]}`;
    send(await this.#answerFor(route, recorded), request, response);
  }

  async #answerFor(route: string, recorded: RecordedRequest): Promise<FakeAnswer> {
    const responder = this.#responders.get(route);
    if (responder !== undefined) return typeof responder === 'function' ? responder(recorded) : responder;
    const segments = route.split('/');
    for (const pattern of this.#patternRoutes) {
      const id = idIn(pattern.segments, segments);
      if (id !== undefined) return pattern.responder(recorded, id);
    }
    return { status: 501, body: { message: `No answer is scripted for ${route}` } };
  }
}

// The decoded ID segment of a route that fits the pattern, or undefined.
function idIn(pattern: readonly string[], route: readonly string[]): string | undefined {
  if (pattern.length !== route.length) return undefined;
  let id: string | undefined;
  for (const [index, part] of pattern.entries()) {
    const actual = route[index] ?? '';
    if (part === idSegment && actual !== '') id = decodeURIComponent(actual);
    else if (part !== actual) return undefined;
  }
  return id;
}

export interface FakeClientSettings {
  readonly retries?: number | 'sdk default';
  readonly timeoutMs?: number;
  readonly checkIssuer?: boolean;
  readonly port?: number;
}

export function workosClientFor(fake: WorkOSFakeApi, settings: FakeClientSettings = {}): WorkOS {
  return new WorkOS({
    apiKey: fakeApiKey,
    clientId: fakeClientId,
    apiHostname: '127.0.0.1',
    https: false,
    port: settings.port ?? fake.port,
    maxRetries: settings.retries === 'sdk default' ? undefined : settings.retries ?? 0,
    timeout: settings.timeoutMs ?? 2_000,
    issuer: settings.checkIssuer === false ? undefined : fake.browserIssuer,
  });
}

export async function refusedLoopbackPort(): Promise<number> {
  const server = createServer();
  const port = await listenOnLoopback(server);
  await closeServer(server);
  return port;
}

async function listenOnLoopback(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function recordedRequest(request: IncomingMessage): Promise<RecordedRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return {
    method: request.method ?? 'GET',
    path: request.url ?? '/',
    body: parsedBody(Buffer.concat(chunks).toString('utf8')),
    authorization: request.headers.authorization,
    idempotencyKey: singleHeader(request.headers['idempotency-key']),
    ifMatch: request.headers['if-match'],
  };
}

function parsedBody(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(', ') : value;
}

function send(answer: FakeAnswer, request: IncomingMessage, response: ServerResponse): void {
  if (answer === 'hang') return;
  if (answer === 'close') {
    request.socket.destroy();
    return;
  }
  if (answer.body === undefined || typeof answer.body === 'string') {
    response.writeHead(answer.status, answer.headers).end(answer.body);
    return;
  }
  response.writeHead(answer.status, { 'content-type': 'application/json', ...answer.headers }).end(JSON.stringify(answer.body));
}
