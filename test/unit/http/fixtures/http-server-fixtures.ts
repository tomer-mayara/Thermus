import assert from 'node:assert/strict';
import diagnostics from 'node:diagnostics_channel';
import { once } from 'node:events';
import { connect, type Socket } from 'node:net';
import type { TestContext } from 'node:test';
import { startHttpServer, type FetchHandler, type HttpServer, type HttpServerOptions } from '../../../../src/http/server.ts';

export const loopback = { host: '127.0.0.1', port: 0 };
export const publicBaseUrl = 'http://localhost:8080/';

export async function serve(t: TestContext, handler: FetchHandler, options: Partial<HttpServerOptions> = {}): Promise<HttpServer> {
  const server = await startHttpServer(handler, { listen: loopback, publicBaseUrl, shutdownGraceMs: 200, ...options });
  t.after(() => server.close(), { timeout: 2_000 });
  return server;
}

export function serverHandles(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'TCPServerWrap').length;
}

// The server accepts a connection after the client connects. Before that, close() only drops it from the backlog.
export function nextAcceptedConnection(server: HttpServer): Promise<Socket> {
  const accepted = Promise.withResolvers<Socket>();
  const onSocket = (message: unknown): void => {
    const { socket } = message as { socket: Socket };
    if (socket.localPort !== Number(server.url.port)) return;
    diagnostics.unsubscribe('net.server.socket', onSocket);
    accepted.resolve(socket);
  };
  diagnostics.subscribe('net.server.socket', onSocket);
  return accepted.promise;
}

// fetch normalizes the request target and sets its own Host header, so these
// tests write raw HTTP/1.1 requests.
export class RawConnection {
  private text = '';
  private readonly socket: Socket;
  readonly ended: Promise<string>;

  private constructor(socket: Socket) {
    this.socket = socket;
    socket.setEncoding('latin1');
    socket.on('data', (chunk: string) => {
      this.text += chunk;
    });
    // The tests check when the connection ends, not why it ends.
    socket.on('error', () => undefined);
    this.ended = new Promise((resolve) => socket.once('close', () => resolve(this.text)));
  }

  static open(t: TestContext, server: HttpServer): RawConnection {
    const socket = connect(Number(server.url.port), server.url.hostname);
    t.after(() => socket.destroy());
    return new RawConnection(socket);
  }

  send(head: readonly string[], body = ''): this {
    this.socket.write(`${head.join('\r\n')}\r\n\r\n${body}`);
    return this;
  }

  async received(part: string): Promise<string> {
    while (!this.text.includes(part)) await once(this.socket, 'data');
    return this.text;
  }

  disconnect(): void {
    this.socket.destroy();
  }
}

export function encoded(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decoded(bytes: Uint8Array | undefined): string {
  return new TextDecoder().decode(bytes);
}

export function bodyReader(response: Response): ReadableStreamDefaultReader<Uint8Array> {
  assert.ok(response.body, 'The response has no body.');
  return response.body.getReader();
}

export async function connectionError(server: HttpServer): Promise<NodeJS.ErrnoException> {
  const socket = connect(Number(server.url.port), server.url.hostname);
  const [error] = await once(socket, 'error');
  return error;
}

export function recordUrls(urls: string[]): FetchHandler {
  return async (request) => {
    urls.push(request.url);
    return new Response('ok');
  };
}
