import { once } from 'node:events';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade']);
const SET_BY_FETCH = new Set(['host']);

export function fetchRequest(incoming: IncomingMessage, outgoing: ServerResponse): Request {
  const disconnected = new AbortController();
  outgoing.once('close', () => {
    if (!outgoing.writableFinished) disconnected.abort();
  });
  const body = incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: Readable.toWeb(incoming), duplex: 'half' as const };
  return new Request(new URL(incoming.url ?? '/', 'http://localhost'), {
    method: incoming.method, headers: headersOf(incoming.rawHeaders, () => true), signal: disconnected.signal, ...body,
  });
}

export function forwardedHeaders(incoming: IncomingMessage): Headers {
  const named = headersNamedByConnection(incoming.headers.connection);
  return headersOf(incoming.rawHeaders, (name) => !isHopByHop(name, named) && !SET_BY_FETCH.has(name.toLowerCase()));
}

export function singleHeader(incoming: IncomingMessage, name: string): string | undefined {
  const value = incoming.headers[name];
  return typeof value === 'string' ? value : undefined;
}

export async function sendResponse(response: Response, outgoing: ServerResponse): Promise<void> {
  const named = headersNamedByConnection(response.headers.get('connection'));
  outgoing.writeHead(response.status, [...response.headers].filter(([name]) => !isHopByHop(name, named)).flat());
  const body = response.body;
  if (body === null || outgoing.destroyed) {
    outgoing.end();
    await body?.cancel();
    return;
  }
  outgoing.flushHeaders();
  const reader = body.getReader();
  const cancel = (): void => { reader.cancel().catch(() => undefined); };
  outgoing.once('close', cancel);
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      if (!outgoing.write(chunk.value)) await drainedOrClosed(outgoing);
    }
  } finally {
    outgoing.off('close', cancel);
  }
  outgoing.end();
}

export function sendJson(outgoing: ServerResponse, status: number, body: object): void {
  outgoing.req.resume();
  const text = JSON.stringify(body);
  outgoing.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  outgoing.end(text);
}

export async function listen(server: Server): Promise<URL> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return new URL(`http://127.0.0.1:${port}/`);
}

export async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  const closed = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  server.closeAllConnections();
  await closed;
}

function isHopByHop(name: string, namedByConnection: ReadonlySet<string>): boolean {
  const lower = name.toLowerCase();
  return HOP_BY_HOP.has(lower) || lower.startsWith('proxy-') || namedByConnection.has(lower);
}

function headersNamedByConnection(value: string | null | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((token) => token.trim().toLowerCase()).filter((token) => token !== ''));
}

function headersOf(raw: readonly string[], keep: (name: string) => boolean): Headers {
  const headers = new Headers();
  for (let index = 0; index < raw.length; index += 2) {
    if (keep(raw[index])) headers.append(raw[index], raw[index + 1]);
  }
  return headers;
}

function drainedOrClosed(outgoing: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      outgoing.off('drain', settle).off('close', settle);
      resolve();
    };
    outgoing.on('drain', settle).on('close', settle);
  });
}
