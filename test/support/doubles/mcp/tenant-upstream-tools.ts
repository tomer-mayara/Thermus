import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { ProtocolError, ProtocolErrorCode, Server, type AuthInfo, type CallToolRequest, type ServerContext } from '@modelcontextprotocol/server';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import { AuditRelaySink } from '../../../../src/logs/audit/audit-relay-sink.ts';

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

export class TenantUpstreamTools {
  readonly slowCalls = new Map<string, SlowCall>();
  readonly slowTicks = SLOW_TICKS;
  readonly #changed: () => void;
  #searchGate?: Promise<void>;
  #runningSearches = 0;
  #relay?: AuditRelaySink;

  constructor(changed: () => void) {
    this.#changed = changed;
  }

  get runningSearches(): number {
    return this.#runningSearches;
  }

  relayTo(controlPlaneInternalUrl: string): void {
    this.#relay = new AuditRelaySink(new URL('internal/audit', `${controlPlaneInternalUrl}/`));
  }

  holdSearches(): { release(): void } {
    const gate = Promise.withResolvers<void>();
    this.#searchGate = gate.promise;
    return { release: () => { this.#searchGate = undefined; gate.resolve(); } };
  }

  close(): void {
    this.#relay?.close();
  }

  serverFor(authInfo: AuthInfo | undefined): Server {
    const scope = scopeOf(authInfo);
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
