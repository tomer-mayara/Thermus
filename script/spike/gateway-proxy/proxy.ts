import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { closeServer, forwardedHeaders, listen, sendJson, sendResponse } from './http-bridge.ts';

interface ProxyExchange { readonly startedAt: number; requestClosedAt?: number; clientGoneAt?: number; status?: number }
export interface Proxy { readonly url: URL; readonly server: HttpServer; readonly exchanges: ProxyExchange[]; close(): Promise<void> }
interface Route { readonly upstream: URL; readonly signContext: () => string; readonly exchanges: ProxyExchange[] }

export async function startProxy(upstream: URL, signContext: () => string): Promise<Proxy> {
  const exchanges: ProxyExchange[] = [];
  const server = createServer((incoming, outgoing) => {
    void forward(incoming, outgoing, { upstream, signContext, exchanges });
  });
  const url = new URL('/mcp', await listen(server));
  return { url, server, exchanges, close: () => closeServer(server) };
}

async function forward(incoming: IncomingMessage, outgoing: ServerResponse, route: Route): Promise<void> {
  if (incoming.url !== '/mcp' || incoming.method !== 'POST') return sendJson(outgoing, 404, { error: 'not_forwarded' });
  const exchange: ProxyExchange = { startedAt: performance.now() };
  route.exchanges.push(exchange);
  // Node ends the incoming request when its body ends, so this close event cannot tell that the client went away.
  incoming.once('close', () => { exchange.requestClosedAt = performance.now(); });
  const clientGone = new AbortController();
  outgoing.once('close', () => {
    if (outgoing.writableFinished) return;
    exchange.clientGoneAt = performance.now();
    clientGone.abort();
  });
  try {
    const response = await fetch(route.upstream, upstreamRequest(incoming, route.signContext(), clientGone.signal));
    exchange.status = response.status;
    await sendResponse(response, outgoing);
  } catch {
    if (clientGone.signal.aborted || outgoing.headersSent) outgoing.destroy();
    else sendJson(outgoing, 502, { error: 'bad_gateway' });
  }
}

function upstreamRequest(incoming: IncomingMessage, access: string, signal: AbortSignal): RequestInit {
  const headers = forwardedHeaders(incoming);
  headers.set('thermus-access', access);
  return { method: 'POST', headers, body: Readable.toWeb(incoming), duplex: 'half', signal, redirect: 'manual' };
}
