import { once } from 'node:events';
import type { RequestListener } from 'node:http';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';

// The HTTPS fronts of the local site: one TLS listener on each loopback address, both on one port.

export interface TlsCertificate {
  readonly key: Buffer | string;
  readonly cert: Buffer | string;
}

interface FrontPlan {
  readonly tls: TlsCertificate;
  // A fixed port, or 0 for a free port.
  readonly port: number;
  readonly listener: RequestListener;
}

const listenAddresses = ['127.0.0.1', '::1'];

function closeFront(front: Server): Promise<void> {
  front.closeAllConnections();
  return new Promise<void>((resolve) => front.close(() => resolve()));
}

function busyPortError(host: string, port: number, cause: unknown): unknown {
  if (!(cause instanceof Error) || (cause as NodeJS.ErrnoException).code !== 'EADDRINUSE') return cause;
  return new Error([
    `Port ${port} of ${host} is in use, so the local HTTPS site did not start.`,
    'Most likely another run of the hosted live gate, the auth WorkOS MCP URL fetch work slice, or the fetch script proof holds it:',
    'they use this fixed port for the registered WorkOS Staging URIs. Wait for that run to end or stop it, then start again.',
  ].join(' '), { cause });
}

// Gives the port of the fronts. With port 0, the second front listens on the free port of the first. One front after the
// other: when a listen fails, the stack already owns each front that listens.
export async function listenFronts(fronts: AsyncDisposableStack, plan: FrontPlan): Promise<number> {
  let port = plan.port;
  for (const host of listenAddresses) {
    const front = createServer(plan.tls, plan.listener);
    front.listen({ host, port });
    await once(front, 'listening').catch((error: unknown) => {
      throw plan.port === 0 ? error : busyPortError(host, port, error);
    });
    fronts.adopt(front, closeFront);
    port = (front.address() as AddressInfo).port;
  }
  return port;
}
