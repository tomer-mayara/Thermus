import { STATUS_CODES, type IncomingMessage, type ServerResponse } from 'node:http';
import { CLIENT_ADDRESS_HEADER } from './client-address.ts';

export type FetchHandler = (request: Request) => Promise<Response>;

export interface Bridge {
  readonly handler: FetchHandler;
  readonly publicOrigin: string;
  readonly logger: { error(message: string): void } | undefined;
}

// In the absolute form, "*", "//", "\", or "#", a URL parser can find another host or a fragment.
const ORIGIN_FORM_TARGET = /^\/(?!\/)[^\\#]*$/;

export async function serve(bridge: Bridge, incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  const target = incoming.url ?? '';
  if (!ORIGIN_FORM_TARGET.test(target)) return sendStatus(outgoing, 400);
  // Node accepts the TRACE method, but a Fetch Request cannot have it.
  if (incoming.method === 'TRACE') return sendStatus(outgoing, 501);
  const url = new URL(`${bridge.publicOrigin}${target}`);
  const disconnected = new AbortController();
  outgoing.once('close', () => {
    if (!outgoing.writableFinished) disconnected.abort();
  });
  try {
    const response = await bridge.handler(fetchRequest(incoming, url, disconnected.signal));
    await sendResponse(response, outgoing, incoming.method);
  } catch (error) {
    // The message has no error text, because that text can contain request data.
    bridge.logger?.error(`The HTTP handler failed for ${incoming.method} ${url.pathname}: ${errorName(error)}`);
    sendFailure(outgoing);
  }
}

function fetchRequest(incoming: IncomingMessage, url: URL, signal: AbortSignal): Request {
  const method = incoming.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? {} : { body: requestBody(incoming), duplex: 'half' as const };
  return new Request(url, { method, headers: requestHeaders(incoming), signal, ...body });
}

// set() replaces every client copy, so the handler can trust the socket address.
function requestHeaders(incoming: IncomingMessage): Headers {
  const headers = new Headers();
  const raw = incoming.rawHeaders;
  for (let index = 0; index < raw.length; index += 2) headers.append(raw[index], raw[index + 1]);
  headers.set(CLIENT_ADDRESS_HEADER, incoming.socket.remoteAddress ?? '');
  return headers;
}

function requestBody(incoming: IncomingMessage): ReadableStream<Uint8Array> {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const data = (chunk: Uint8Array): void => {
    incoming.pause();
    controller.enqueue(chunk);
  };
  const end = (): void => { detach(); controller.close(); };
  const error = (cause: Error): void => { detach(); controller.error(cause); };
  const close = (): void => error(new DOMException('The request body disconnected', 'AbortError'));
  const detach = (): void => {
    incoming.off('data', data).off('end', end).off('error', error).off('close', close);
  };
  return new ReadableStream<Uint8Array>({
    start(body) {
      controller = body;
      incoming.pause();
      incoming.on('data', data).once('end', end).once('error', error).once('close', close);
    },
    pull() { incoming.resume(); },
    cancel() {
      detach();
      // Discard unread bytes without destroying the socket that carries the refusal response.
      incoming.resume();
    },
  }, { highWaterMark: 0 });
}

// A flat header list keeps each Set-Cookie header separate.
async function sendResponse(response: Response, outgoing: ServerResponse, method: string | undefined): Promise<void> {
  const statusText = response.statusText === '' ? undefined : response.statusText;
  outgoing.writeHead(response.status, statusText, [...response.headers].flat());
  const body = response.body;
  if (body === null || method === 'HEAD' || outgoing.destroyed) {
    outgoing.end();
    await body?.cancel();
    return;
  }
  // A streamed body, such as Server-Sent Events, can send its first chunk much later.
  outgoing.flushHeaders();
  await sendBody(body.getReader(), outgoing);
}

// Cancelling the body when the connection closes lets an endless stream stop its work.
async function sendBody(reader: ReadableStreamDefaultReader<Uint8Array>, outgoing: ServerResponse): Promise<void> {
  const cancel = (): void => {
    // A failed cancel has no client to report to.
    reader.cancel().catch(() => undefined);
  };
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

function drainedOrClosed(outgoing: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      outgoing.off('drain', settle).off('close', settle);
      resolve();
    };
    outgoing.on('drain', settle).on('close', settle);
  });
}

// After the headers are sent, only an ended connection can tell the client that the response failed.
function sendFailure(outgoing: ServerResponse): void {
  if (outgoing.headersSent) outgoing.destroy();
  else sendStatus(outgoing, 500);
}

function sendStatus(outgoing: ServerResponse, status: number): void {
  const text = STATUS_CODES[status] ?? '';
  outgoing.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  outgoing.end(text);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown error';
}
