import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import type { ListenAddress } from '../config/deployment-config.ts';
import { serve, type Bridge, type FetchHandler } from './fetch-exchange.ts';

export type { FetchHandler } from './fetch-exchange.ts';

export interface HttpServerOptions {
  readonly listen: ListenAddress;
  readonly publicBaseUrl: string;
  readonly shutdownGraceMs?: number;
  readonly logger?: { error(message: string): void };
}

export interface HttpServer {
  readonly url: URL;
  close(): Promise<void>;
}

const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;

export async function startHttpServer(handler: FetchHandler, options: HttpServerOptions): Promise<HttpServer> {
  await using owned = new AsyncDisposableStack();
  const bridge: Bridge = { handler, publicOrigin: new URL(options.publicBaseUrl).origin, logger: options.logger };
  const server = createServer((incoming, outgoing) => {
    // After close(), Node keeps a finished keep-alive connection open until its timeout.
    outgoing.once('finish', () => afterRequestEnds(incoming, () => {
      if (!server.listening) server.closeIdleConnections();
    }));
    void serve(bridge, incoming, outgoing);
  });
  const connections = trackConnections(server);
  server.listen({ host: options.listen.host, port: options.listen.port });
  await once(server, 'listening');
  owned.defer(() => closeServer(server, connections, options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS));
  const url = listenUrl(server);
  const resources = owned.move();
  let closing: Promise<void> | undefined;
  return {
    url,
    close: () => (closing ??= resources.disposeAsync()),
  };
}

function listenUrl(server: Server): URL {
  const { address, port } = server.address() as AddressInfo;
  const host = address.includes(':') ? `[${address}]` : address;
  return new URL(`http://${host}:${port}/`);
}

// Node counts a connection as idle only after it has read the complete request. A response can end before that: Node
// stops reading an unread body at its buffer limit and discards the rest after the response, a handler can answer
// while Node still reads the body, and a client can still send it.
function afterRequestEnds(incoming: IncomingMessage, action: () => void): void {
  if (incoming.complete) action();
  else incoming.once('end', action);
}

function trackConnections(server: Server): ReadonlySet<Socket> {
  const connections = new Set<Socket>();
  server.on('connection', (socket: Socket) => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  return connections;
}

async function closeServer(server: Server, connections: ReadonlySet<Socket>, graceMs: number): Promise<void> {
  const closed = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  // close() keeps a connection without bytes as if a request were active. A fetch client can open one after it aborts
  // a request and keep it until its idle timeout. Node starts a request only after it reads bytes, so no work is lost.
  for (const socket of connections) if (socket.bytesRead === 0) socket.destroy();
  const deadline = setTimeout(() => server.closeAllConnections(), graceMs);
  try {
    await closed;
  } finally {
    clearTimeout(deadline);
  }
}
