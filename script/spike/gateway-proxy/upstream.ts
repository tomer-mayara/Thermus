import type { KeyObject } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createMcpHandler, ProtocolError, ProtocolErrorCode, Server,
  type AuthInfo, type CallToolRequest, type McpHttpHandler, type ServerContext,
} from '@modelcontextprotocol/server';
import { verifyAccess, type AccessContext } from './access-context.ts';
import { closeServer, fetchRequest, listen, sendJson, sendResponse, singleHeader } from './http-bridge.ts';

export const TICK_MS = 200;
export const TICKS = 15;

export interface SlowCall {
  readonly label: string;
  readonly startedAt: number;
  readonly progressSentAt: number[];
  signalAt?: number;
  stoppedAt?: number;
  finishedAt?: number;
}
interface AcceptedRequest { readonly headers: Headers; readonly context: AccessContext }
interface Gate { readonly handler: McpHttpHandler; readonly publicKey: KeyObject; readonly accepted: AcceptedRequest[] }
export interface Upstream {
  readonly url: URL;
  readonly server: HttpServer;
  readonly calls: Map<string, SlowCall>;
  readonly accepted: AcceptedRequest[];
  readonly stats: { mcpRequests: number };
  close(): Promise<void>;
}

const slowTool = {
  name: 'slow',
  description: 'Send a progress notification every 200 ms for 3 seconds, then answer with text.',
  inputSchema: { type: 'object' as const, properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false },
};

export async function startUpstream(publicKey: KeyObject): Promise<Upstream> {
  const calls = new Map<string, SlowCall>();
  const accepted: AcceptedRequest[] = [];
  const stats = { mcpRequests: 0 };
  const handler = createMcpHandler(({ authInfo }) => {
    stats.mcpRequests += 1;
    return slowServer(organizationOf(authInfo), calls);
  });
  const server = createServer((incoming, outgoing) => {
    serveUpstream(incoming, outgoing, { handler, publicKey, accepted }).catch(() => outgoing.destroy());
  });
  const url = await listen(server);
  return { url, server, calls, accepted, stats, close: async () => { await closeServer(server); await handler.close(); } };
}

async function serveUpstream(incoming: IncomingMessage, outgoing: ServerResponse, gate: Gate): Promise<void> {
  if (incoming.url !== '/mcp') return sendJson(outgoing, 404, { error: 'not_found' });
  const decision = verifyAccess(singleHeader(incoming, 'thermus-access'), gate.publicKey);
  if ('reason' in decision) return sendJson(outgoing, 403, { error: 'access_denied', reason: decision.reason });
  const request = fetchRequest(incoming, outgoing);
  gate.accepted.push({ headers: new Headers(request.headers), context: decision.context });
  const authInfo: AuthInfo = { token: '', clientId: 'gateway-probe', scopes: [], extra: { organizationId: decision.context.organizationId } };
  await sendResponse(await gate.handler.fetch(request, { authInfo }), outgoing);
}

function organizationOf(authInfo: AuthInfo | undefined): string {
  const organizationId = authInfo?.extra?.organizationId;
  if (typeof organizationId !== 'string') throw new Error('The request has no verified access context');
  return organizationId;
}

function slowServer(organizationId: string, calls: Map<string, SlowCall>): Server {
  const server = new Server({ name: 'gateway-probe-upstream', version: '0.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', () => ({ tools: [slowTool] }));
  server.setRequestHandler('tools/call', async (request, ctx) => {
    if (request.params.name !== 'slow') throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Unknown tool');
    const call = newCall(request);
    calls.set(call.label, call);
    await runSlow(call, ctx);
    return server.projectCallToolResult({ content: [{ type: 'text', text: `slow finished for ${organizationId}` }] }, undefined);
  });
  return server;
}

function newCall(request: CallToolRequest): SlowCall {
  const label = request.params.arguments?.label;
  if (typeof label !== 'string') throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'The slow tool needs a label');
  return { label, startedAt: performance.now(), progressSentAt: [] };
}

async function runSlow(call: SlowCall, ctx: ServerContext): Promise<void> {
  const signal = ctx.mcpReq.signal;
  signal.addEventListener('abort', () => { call.signalAt = performance.now(); }, { once: true });
  const progressToken = ctx.mcpReq._meta?.progressToken;
  try {
    for (let tick = 1; tick <= TICKS; tick += 1) {
      await delay(msUntilTick(call.startedAt, tick), undefined, { signal });
      call.progressSentAt.push(performance.now());
      if (progressToken !== undefined) {
        await ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken, progress: tick, total: TICKS } });
      }
    }
    call.finishedAt = performance.now();
  } catch (error) {
    call.stoppedAt = performance.now();
    throw error;
  }
}

function msUntilTick(startedAt: number, tick: number): number {
  return Math.max(0, startedAt + tick * TICK_MS - performance.now());
}
