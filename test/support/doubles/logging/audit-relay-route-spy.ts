import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';

export interface RelayedRequest {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly host: string | undefined;
  readonly context: string | undefined;
  readonly contentType: string | undefined;
  readonly event: Record<string, unknown>;
}

// accept answers 202, refuse answers 503, and hang never answers.
export type RelayAnswer = 'accept' | 'refuse' | 'hang';

// A spy of the relay route POST /internal/audit of the control plane, which SO-05 adds. It records each request of a
// tenant relay sink: the access context, the content type, and the event.
export class AuditRelayRouteSpy {
  readonly received: RelayedRequest[] = [];
  answer: RelayAnswer = 'accept';
  readonly #held = new Set<ServerResponse>();
  readonly #waiters: Array<{ count: number; ready: () => void }> = [];
  #origin = '';

  static async start(t: TestContext): Promise<AuditRelayRouteSpy> {
    const spy = new AuditRelayRouteSpy();
    const server = createServer((request, response) => { void spy.#record(request, response); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    spy.#origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    t.after(async () => {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    });
    return spy;
  }

  // CONTROL_PLANE_INTERNAL_URL of the tenant.
  get origin(): string {
    return this.#origin;
  }

  // The relay requests that have no answer.
  get open(): number {
    return this.#held.size;
  }

  untilReceived(count: number): Promise<void> {
    if (this.received.length >= count) return Promise.resolve();
    const ready = Promise.withResolvers<void>();
    this.#waiters.push({ count, ready: () => ready.resolve() });
    return ready.promise;
  }

  async #record(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    this.received.push({
      method: request.method,
      path: request.url,
      host: request.headers.host,
      context: request.headers['thermus-access'] as string | undefined,
      contentType: request.headers['content-type'],
      event: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
    });
    for (const waiter of this.#waiters) if (this.received.length >= waiter.count) waiter.ready();
    if (this.answer === 'hang') {
      this.#held.add(response);
      response.once('close', () => this.#held.delete(response));
      return;
    }
    response.writeHead(this.answer === 'accept' ? 202 : 503).end();
  }
}
