import { randomUUID, type KeyObject } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createMcpHandler, ProtocolError, ProtocolErrorCode, Server, type AuthInfo, type CallToolRequest, type ServerContext } from '@modelcontextprotocol/server';
import type { RoleGrant } from '../../../../src/accounts/identity/access-context.ts';
import { AccessContextVerifier } from '../../../../src/accounts/identity/access-context-verifier.ts';
import { ACCESS_CONTEXT_HEADER } from '../../../../src/accounts/identity/signed-access-context.ts';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import { AuditRelaySink } from '../../../../src/logs/audit/audit-relay-sink.ts';
import { serve, type Bridge } from '../../../../src/runtime/http/fetch-exchange.ts';

// The failures of a tenant container that restarts: Render answers 502, or the connection resets before or after the
// first answer byte (record SO-01e).
export type UpstreamFailure = 'http-502' | 'reset-before-answer' | 'reset-after-start';

// The context that the fake verified, without its expiry.
export interface VerifiedContextRecord {
  readonly authority: string;
  readonly subject: string;
  readonly name?: string;
  readonly organizationId: string;
  readonly grants: readonly RoleGrant[];
}

export interface UpstreamRequest {
  readonly method: string;
  readonly path: string;
  // Lower-case header names, as the tenant received them.
  readonly headers: Readonly<Record<string, string>>;
  readonly bearerToken?: string;
  readonly rpcMethod?: string;
  readonly toolName?: string;
  readonly context?: VerifiedContextRecord;
  answerStatus?: number;
  // When the HTTP request of the tenant aborted: the client of the tenant went away.
  signalAt?: number;
}

export interface SlowCall {
  readonly progressSentAt: number[];
  signalAt?: number;
  finishedAt?: number;
}

interface CallScope {
  readonly organizationId: string;
  readonly context: string;
  readonly user: { readonly authority: string; readonly subject: string };
}

const SLOW_TICKS = 6;
const TICK_MS = 100;
const tools: Array<{ readonly name: string; readonly inputSchema: { readonly type: 'object'; readonly properties: Record<string, { readonly type: string }> } }> = [
  { name: 'getURLAsMarkdown', inputSchema: { type: 'object', properties: { url: { type: 'string' }, reason: { type: 'string' } } } },
  { name: 'search', inputSchema: { type: 'object', properties: { query: { type: 'string' }, reason: { type: 'string' } } } },
  { name: 'slow', inputSchema: { type: 'object', properties: { label: { type: 'string' } } } },
];

// A fake of the tenant container of one organization behind the gateway. Like the tenant role, it refuses a request
// without a valid Thermus-Access context for its organization and the bearer token of the request with 403, and then
// serves MCP with one server for each request through the production HTTP bridge. Its tools answer with text that names
// the organization of the verified context; getURLAsMarkdown relays one audit event to the control plane with the
// context, through the production relay sink. A test can script the failures of a restart, hold an answer, and hold
// searches.
export class TenantUpstreamFake {
  readonly requests: UpstreamRequest[] = [];
  readonly slowCalls = new Map<string, SlowCall>();
  readonly slowTicks = SLOW_TICKS;
  readonly #verifier: AccessContextVerifier;
  readonly #organizationId: string;
  readonly #failures: UpstreamFailure[] = [];
  readonly #waiters = new Set<() => void>();
  #origin = '';
  #heldAnswer?: { readonly gate: Promise<void>; readonly arrived: (request: UpstreamRequest) => void };
  #searchGate?: Promise<void>;
  #runningSearches = 0;
  #relay?: AuditRelaySink;

  private constructor(publicKey: KeyObject, organizationId: string) {
    this.#verifier = new AccessContextVerifier({ publicKeys: [publicKey], organizationId });
    this.#organizationId = organizationId;
  }

  static async start(t: TestContext, options: { readonly publicKey: KeyObject; readonly organizationId: string }): Promise<TenantUpstreamFake> {
    const fake = new TenantUpstreamFake(options.publicKey, options.organizationId);
    const handler = createMcpHandler(({ authInfo }) => fake.#serverFor(scopeOf(authInfo)));
    const bridge: Bridge = { handler: (request) => fake.#answer(request, handler.fetch), publicOrigin: 'https://thermus.example', logger: undefined };
    const server = createServer((incoming, outgoing) => { void fake.#route(bridge, incoming, outgoing); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    fake.#origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(async () => {
      fake.#relay?.close();
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
      await handler.close();
    });
    return fake;
  }

  // The internal_url of the tenant in the registry.
  get origin(): string {
    return this.#origin;
  }

  // The tenant relays the audit events of getURLAsMarkdown to the control plane at this internal origin.
  relayTo(controlPlaneInternalUrl: string): void {
    this.#relay = new AuditRelaySink(new URL('internal/audit', `${controlPlaneInternalUrl}/`));
  }

  // The next tools/call fails as a restarted container does.
  failNext(failure: UpstreamFailure): void {
    this.#failures.push(failure);
  }

  // The next MCP request waits before any MCP handling until release().
  holdNextAnswer(): { readonly arrived: Promise<UpstreamRequest>; release(): void } {
    const gate = Promise.withResolvers<void>();
    const arrived = Promise.withResolvers<UpstreamRequest>();
    this.#heldAnswer = { gate: gate.promise, arrived: arrived.resolve };
    return { arrived: arrived.promise, release: () => gate.resolve() };
  }

  // Each search waits until release().
  holdSearches(): { release(): void } {
    const gate = Promise.withResolvers<void>();
    this.#searchGate = gate.promise;
    return { release: () => { this.#searchGate = undefined; gate.resolve(); } };
  }

  untilSearches(count: number): Promise<void> {
    return this.#until(() => this.#runningSearches >= count);
  }

  untilProgress(label: string, count: number): Promise<void> {
    return this.#until(() => (this.slowCalls.get(label)?.progressSentAt.length ?? 0) >= count);
  }

  // The time when the tenant saw the signal of a slow call (by label) or of an HTTP request.
  async untilSignal(target: string | UpstreamRequest): Promise<number> {
    const signalAt = () => (typeof target === 'string' ? this.slowCalls.get(target)?.signalAt : target.signalAt);
    await this.#until(() => signalAt() !== undefined);
    return signalAt() ?? Number.NaN;
  }

  #until(ready: () => boolean): Promise<void> {
    if (ready()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = (): void => {
        if (!ready()) return;
        this.#waiters.delete(check);
        resolve();
      };
      this.#waiters.add(check);
    });
  }

  #changed(): void {
    for (const check of [...this.#waiters]) check();
  }

  async #route(bridge: Bridge, incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    const failure = incoming.headers['mcp-method'] === 'tools/call' ? this.#failures.shift() : undefined;
    if (failure === undefined) return serve(bridge, incoming, outgoing);
    this.requests.push({ method: incoming.method ?? '', path: incoming.url ?? '', headers: headersOf(incoming), rpcMethod: 'tools/call' });
    for await (const _chunk of incoming) { /* The failure comes after the request body. */ }
    if (failure === 'http-502') {
      outgoing.writeHead(502, { 'Content-Type': 'text/html' }).end('<html><body>Bad Gateway</body></html>');
    } else if (failure === 'reset-before-answer') {
      incoming.socket.destroy();
    } else {
      outgoing.writeHead(200, { 'Content-Type': 'text/event-stream' });
      outgoing.write('event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":1,"progress":1}}\n\n');
      await delay(50);
      incoming.socket.destroy();
    }
  }

  async #answer(request: Request, mcp: (request: Request, options: { authInfo: AuthInfo }) => Promise<Response>): Promise<Response> {
    const body = request.method === 'POST' ? await request.text() : '';
    const header = request.headers.get(ACCESS_CONTEXT_HEADER) ?? '';
    const bearerToken = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    const verification = await this.#verifier.verify(header, bearerToken);
    const record: UpstreamRequest = {
      method: request.method, path: new URL(request.url).pathname, headers: Object.fromEntries(request.headers), ...messageOf(body),
      ...(bearerToken === undefined ? {} : { bearerToken }),
      ...(verification.status === 'verified' ? { context: contextRecordOf(verification.context) } : {}),
    };
    this.requests.push(record);
    request.signal.addEventListener('abort', () => { record.signalAt = performance.now(); this.#changed(); }, { once: true });
    const answer = verification.status === 'verified'
      ? await this.#mcpAnswer(request, body, record, mcp)
      : Response.json({ error: 'access_denied', error_description: 'Access denied' }, { status: 403 });
    record.answerStatus = answer.status;
    this.#changed();
    return answer;
  }

  async #mcpAnswer(request: Request, body: string, record: UpstreamRequest, mcp: (request: Request, options: { authInfo: AuthInfo }) => Promise<Response>): Promise<Response> {
    const held = this.#heldAnswer;
    this.#heldAnswer = undefined;
    if (held !== undefined) {
      held.arrived(record);
      await Promise.race([held.gate, once(request.signal, 'abort')]);
    }
    const context = record.context as VerifiedContextRecord;
    const authInfo: AuthInfo = {
      token: record.bearerToken ?? '', clientId: 'tenant-upstream-fake', scopes: [],
      extra: { organizationId: context.organizationId, context: request.headers.get(ACCESS_CONTEXT_HEADER), authority: context.authority, subject: context.subject },
    };
    const init: RequestInit = { method: request.method, headers: request.headers, signal: request.signal, ...(request.method === 'POST' ? { body } : {}) };
    return mcp(new Request(request.url, init), { authInfo });
  }

  #serverFor(scope: CallScope): Server {
    const server = new Server({ name: 'tenant-upstream-fake', version: '0.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler('tools/list', () => ({ tools }));
    server.setRequestHandler('tools/call', async (request, context) => {
      const text = await this.#call(request, context, scope);
      return server.projectCallToolResult({ content: [{ type: 'text', text }] }, undefined);
    });
    return server;
  }

  async #call(request: CallToolRequest, context: ServerContext, scope: CallScope): Promise<string> {
    const args = request.params.arguments ?? {};
    if (request.params.name === 'getURLAsMarkdown') return this.#fetched(String(args.url), String(args.reason), scope);
    if (request.params.name === 'search') return this.#searched(String(args.query), context.mcpReq.signal, scope);
    if (request.params.name === 'slow') return this.#slow(String(args.label), context, scope);
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
  }

  #fetched(url: string, reason: string, scope: CallScope): string {
    const text = `Markdown of ${url} from the tenant of ${scope.organizationId}`;
    if (this.#relay !== undefined) {
      new AuditLog(this.#relay.forContext(scope.context)).toolCompleted({
        tool: 'getURLAsMarkdown', input: { url, reason }, timestamp: new Date().toISOString(), organizationId: `${scope.user.authority}:${scope.organizationId}`,
        actor: scope.user, operationId: randomUUID(), status: 'success', durationMs: 5, result: text,
      });
    }
    return text;
  }

  async #searched(query: string, signal: AbortSignal, scope: CallScope): Promise<string> {
    this.#runningSearches += 1;
    this.#changed();
    try {
      if (this.#searchGate !== undefined) await Promise.race([this.#searchGate, once(signal, 'abort')]);
      return `Results for ${query} from the tenant of ${scope.organizationId}`;
    } finally {
      this.#runningSearches -= 1;
    }
  }

  async #slow(label: string, context: ServerContext, scope: CallScope): Promise<string> {
    const call: SlowCall = { progressSentAt: [] };
    this.slowCalls.set(label, call);
    const signal = context.mcpReq.signal;
    signal.addEventListener('abort', () => { call.signalAt = performance.now(); this.#changed(); }, { once: true });
    const progressToken = context.mcpReq._meta?.progressToken;
    for (let tick = 1; tick <= SLOW_TICKS; tick += 1) {
      await delay(TICK_MS, undefined, { signal });
      if (progressToken !== undefined) await context.mcpReq.notify({ method: 'notifications/progress', params: { progressToken, progress: tick, total: SLOW_TICKS } });
      call.progressSentAt.push(performance.now());
      this.#changed();
    }
    call.finishedAt = performance.now();
    return `slow ${label} finished for ${scope.organizationId}`;
  }
}

function scopeOf(authInfo: AuthInfo | undefined): CallScope {
  const extra = authInfo?.extra as { organizationId?: unknown; context?: unknown; authority?: unknown; subject?: unknown } | undefined;
  if (typeof extra?.organizationId !== 'string' || typeof extra.context !== 'string' || typeof extra.authority !== 'string' || typeof extra.subject !== 'string') {
    throw new Error('The request has no verified access context');
  }
  return { organizationId: extra.organizationId, context: extra.context, user: { authority: extra.authority, subject: extra.subject } };
}

function contextRecordOf(context: VerifiedContextRecord & { readonly expiresAtUnixSeconds: number }): VerifiedContextRecord {
  const { expiresAtUnixSeconds: _expiry, ...record } = context;
  return record;
}

function headersOf(incoming: IncomingMessage): Record<string, string> {
  return Object.fromEntries(Object.entries(incoming.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value ?? '']));
}

function messageOf(body: string): { readonly rpcMethod?: string; readonly toolName?: string } {
  try {
    const message = JSON.parse(body) as { method?: unknown; params?: { name?: unknown } };
    return {
      ...(typeof message.method === 'string' ? { rpcMethod: message.method } : {}),
      ...(typeof message.params?.name === 'string' ? { toolName: message.params.name } : {}),
    };
  } catch {
    return {};
  }
}
