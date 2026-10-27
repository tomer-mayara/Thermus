import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import Stripe from 'stripe';

// The local listener of the webhook step, on the loopback address. It verifies each request with the signature check
// of the SDK on the raw body, as POST /billing/events of SO-13 must: 200 for a valid signature, 400 for any other.
export const WEBHOOK_PATH = '/stripe/events';
export const CHECK_HEADER = 'x-thermus-probe-check';
const BODY_LIMIT = 1024 * 1024;
const WAIT_STEP_MS = 200;

export interface Delivery {
  readonly at: number;
  readonly label: string;
  readonly status: number;
  readonly eventId?: string;
  readonly type?: string;
  readonly objectId?: string;
  readonly customerId?: string;
  readonly runMatch: boolean;
  readonly error?: string;
  readonly raw: string;
  readonly signature?: string;
}

interface EventObject {
  readonly id?: unknown;
  readonly customer?: unknown;
  readonly metadata?: Readonly<Record<string, string>>;
}

function readBody(request: IncomingMessage): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= BODY_LIMIT) chunks.push(chunk);
    });
    request.on('end', () => resolve(size > BODY_LIMIT ? undefined : Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function answer(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

type Received = Pick<Delivery, 'at' | 'label' | 'raw' | 'signature'>;

function verified(event: Stripe.Event, received: Received, run: string): Delivery {
  const object = event.data.object as EventObject;
  const objectId = typeof object.id === 'string' ? object.id : undefined;
  const customerId = typeof object.customer === 'string' ? object.customer : undefined;
  return { ...received, status: 200, eventId: event.id, type: event.type, objectId, customerId, runMatch: object.metadata?.thermus_probe_run === run };
}

export class WebhookListener {
  readonly #server: Server;
  readonly #secret: string;
  readonly #run: string;
  public readonly deliveries: Delivery[] = [];

  private constructor(secret: string, run: string) {
    this.#secret = secret;
    this.#run = run;
    this.#server = createServer((request, response) => void this.#handle(request, response));
  }

  public static async start(secret: string, run: string): Promise<WebhookListener> {
    const listener = new WebhookListener(secret, run);
    await new Promise<void>((resolve, reject) => {
      listener.#server.once('error', reject);
      listener.#server.listen(0, '127.0.0.1', resolve);
    });
    return listener;
  }

  public get url(): string {
    return `http://127.0.0.1:${(this.#server.address() as AddressInfo).port}${WEBHOOK_PATH}`;
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'POST' || request.url !== WEBHOOK_PATH) return answer(response, 404, { error: 'not found' });
    const raw = await readBody(request);
    if (raw === undefined) return answer(response, 413, { error: 'too large' });
    const signature = header(request, 'stripe-signature');
    const received: Received = { at: performance.now(), label: header(request, CHECK_HEADER) ?? 'forwarded by the Stripe CLI', raw, signature };
    try {
      this.deliveries.push(verified(Stripe.webhooks.constructEvent(raw, signature ?? '', this.#secret), received, this.#run));
      return answer(response, 200, { received: true });
    } catch (error) {
      const refused = error instanceof Stripe.errors.StripeSignatureVerificationError ? 'StripeSignatureVerificationError' : 'not an event';
      this.deliveries.push({ ...received, status: 400, runMatch: false, error: refused });
      return answer(response, 400, { error: 'signature' });
    }
  }

  public async waitFor(found: (delivery: Delivery) => boolean, limitMs: number, signal: AbortSignal): Promise<Delivery> {
    const deadline = performance.now() + limitMs;
    for (;;) {
      const delivery = this.deliveries.find(found);
      if (delivery !== undefined) return delivery;
      signal.throwIfAborted();
      if (performance.now() > deadline) throw new Error(`No matching delivery within ${limitMs / 1_000} s. Deliveries: ${this.deliveries.map((item) => `${item.label} ${item.status} ${item.type ?? item.error ?? ''}`).join('; ') || 'none'}.`);
      await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
    }
  }

  public close(): Promise<void> {
    const closed = new Promise<void>((resolve) => this.#server.close(() => resolve()));
    this.#server.closeAllConnections();
    return closed;
  }
}
