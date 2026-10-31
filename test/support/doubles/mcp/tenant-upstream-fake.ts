import type { KeyObject } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';
import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { AccessContextVerifier } from '../../../../src/accounts/identity/access-context-verifier.ts';
import { ACCESS_CONTEXT_HEADER } from '../../../../src/accounts/identity/signed-access-context.ts';
import { serve, type Bridge } from '../../../../src/runtime/http/fetch-exchange.ts';
import { failAsRestart, type UpstreamFailure } from './tenant-restart-failures.ts';
import { bearerTokenOf, failedCallRecordOf, upstreamRecordOf, type UpstreamRequest, type VerifiedContextRecord } from './tenant-upstream-records.ts';
import { TenantUpstreamTools, type SlowCall } from './tenant-upstream-tools.ts';

type McpHandler = (request: Request, options: { authInfo: AuthInfo }) => Promise<Response>;

export class TenantUpstreamFake {
  readonly requests: UpstreamRequest[] = [];
  readonly #tools = new TenantUpstreamTools(() => this.#changed());
  readonly #verifier: AccessContextVerifier;
  readonly #failures: UpstreamFailure[] = [];
  readonly #waiters = new Set<() => void>();
  #origin = '';
  #heldAnswer?: { readonly gate: Promise<void>; readonly arrived: (request: UpstreamRequest) => void };
  #mcp: McpHandler = async () => new Response(null, { status: 503 });

  private constructor(publicKey: KeyObject, organizationId: string) {
    this.#verifier = new AccessContextVerifier({ publicKeys: [publicKey], organizationId });
  }

  static async start(t: TestContext, options: { readonly publicKey: KeyObject; readonly organizationId: string }): Promise<TenantUpstreamFake> {
    const fake = new TenantUpstreamFake(options.publicKey, options.organizationId);
    const handler = createMcpHandler(({ authInfo }) => fake.#tools.serverFor(authInfo));
    fake.#mcp = (request, options) => handler.fetch(request, options);
    const bridge: Bridge = { handler: (request) => fake.#answer(request), publicOrigin: 'https://thermus.example', logger: undefined };
    const server = createServer((incoming, outgoing) => { void fake.#route(bridge, incoming, outgoing); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    fake.#origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(async () => {
      fake.#tools.close();
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
      await handler.close();
    });
    return fake;
  }

  get origin(): string {
    return this.#origin;
  }

  get slowCalls(): ReadonlyMap<string, SlowCall> {
    return this.#tools.slowCalls;
  }

  get slowTicks(): number {
    return this.#tools.slowTicks;
  }

  relayTo(controlPlaneInternalUrl: string): void {
    this.#tools.relayTo(controlPlaneInternalUrl);
  }

  failNext(failure: UpstreamFailure): void {
    this.#failures.push(failure);
  }

  holdNextAnswer(): { readonly arrived: Promise<UpstreamRequest>; release(): void } {
    const gate = Promise.withResolvers<void>();
    const arrived = Promise.withResolvers<UpstreamRequest>();
    this.#heldAnswer = { gate: gate.promise, arrived: arrived.resolve };
    return { arrived: arrived.promise, release: () => gate.resolve() };
  }

  holdSearches(): { release(): void } {
    return this.#tools.holdSearches();
  }

  untilSearches(count: number): Promise<void> {
    return this.#until(() => this.#tools.runningSearches >= count);
  }

  untilProgress(label: string, count: number): Promise<void> {
    return this.#until(() => (this.#tools.slowCalls.get(label)?.progressSentAt.length ?? 0) >= count);
  }

  async untilSignal(target: string | UpstreamRequest): Promise<number> {
    const signalAt = () => (typeof target === 'string' ? this.#tools.slowCalls.get(target)?.signalAt : target.signalAt);
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
    this.requests.push(failedCallRecordOf(incoming));
    await failAsRestart(failure, incoming, outgoing);
  }

  async #answer(request: Request): Promise<Response> {
    const body = request.method === 'POST' ? await request.text() : '';
    const header = request.headers.get(ACCESS_CONTEXT_HEADER) ?? '';
    const verification = await this.#verifier.verify(header, bearerTokenOf(request));
    const record = upstreamRecordOf(request, body, verification);
    this.requests.push(record);
    request.signal.addEventListener('abort', () => { record.signalAt = performance.now(); this.#changed(); }, { once: true });
    const answer = verification.status === 'verified'
      ? await this.#mcpAnswer(request, body, record)
      : Response.json({ error: 'access_denied', error_description: 'Access denied' }, { status: 403 });
    record.answerStatus = answer.status;
    this.#changed();
    return answer;
  }

  async #mcpAnswer(request: Request, body: string, record: UpstreamRequest): Promise<Response> {
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
    return this.#mcp(new Request(request.url, init), { authInfo });
  }
}
