import Stripe from 'stripe';
import { callLine, type Call, type WriteRecord } from './calls.ts';
import { redact } from './secrets.ts';

export type StripeCall<Result> = Call<Stripe, Result>;
export type Removal = 'deleted' | 'gone';

const TIMEOUT_MS = 30_000;
// The SDK repeats a request after a network failure, a 409, or a 5xx answer, unless Stripe marks it as not safe to
// repeat. It sends one idempotency key with every attempt of a POST, so a repeated create cannot double its effect.
const NETWORK_RETRIES = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statusOf(answer: unknown): string {
  const last = isRecord(answer) ? answer.lastResponse : undefined;
  return isRecord(last) && typeof last.statusCode === 'number' ? String(last.statusCode) : 'answered';
}

function errorStatus(error: unknown): string {
  return error instanceof Stripe.errors.StripeError && error.statusCode !== undefined ? String(error.statusCode) : 'no answer';
}

function errorText(call: StripeCall<unknown>, error: unknown): string {
  if (!(error instanceof Stripe.errors.StripeError)) return `${callLine(call)} got no answer: ${redact(error instanceof Error ? error.message : String(error))}`;
  const status = error.statusCode === undefined ? 'with no status' : `HTTP ${error.statusCode}`;
  const code = error.code === undefined ? '' : `/${error.code}`;
  const request = error.requestId === undefined ? '' : ` (request ${error.requestId})`;
  return `${callLine(call)} answered ${status} ${error.type}${code}: ${redact(error.message)}${request}`;
}

// Defense in depth: a restricted test key cannot reach live mode, but the probe stops at any live-mode object.
function refuseLiveObject(call: StripeCall<unknown>, answer: unknown): void {
  if (!isRecord(answer)) return;
  const items: unknown[] = Array.isArray(answer.data) ? answer.data : [answer];
  if (items.some((item) => isRecord(item) && item.livemode === true)) {
    throw new Error(`${callLine(call)} answered with a live-mode object. The probe stops: it runs in Stripe test mode only.`);
  }
}

// The client wraps each SDK error in an Error with a redacted message; the SDK error is its cause.
function sdkError(error: unknown): unknown {
  return error instanceof Error && error.cause !== undefined ? error.cause : error;
}

export function isMissing(error: unknown): boolean {
  const cause = sdkError(error);
  return cause instanceof Stripe.errors.StripeError && cause.statusCode === 404;
}

export class StripeProbeClient {
  readonly #stripe: Stripe;
  #writesAllowed = false;
  public readonly writes: WriteRecord[] = [];
  public reads = 0;

  public constructor(key: string) {
    this.#stripe = new Stripe(key, { maxNetworkRetries: NETWORK_RETRIES, timeout: TIMEOUT_MS, telemetry: false, appInfo: { name: 'thermus-so-01f-probe' } });
  }

  // The preflight makes reads only. The entry allows writes after it passes, and always for the cleanup.
  public allowWrites(): void {
    this.#writesAllowed = true;
  }

  public async read<Result>(call: StripeCall<Result>, signal: AbortSignal): Promise<Result> {
    if (call.method !== 'GET') throw new Error(`${callLine(call)} is a write, not a read`);
    signal.throwIfAborted();
    const answer = await this.#send(call);
    this.reads += 1;
    return answer;
  }

  public async write<Result>(step: string, call: StripeCall<Result>, signal: AbortSignal): Promise<Result> {
    if (!this.#writesAllowed) throw new Error(`${callLine(call)} refused: the preflight makes reads only`);
    signal.throwIfAborted();
    const started = performance.now();
    try {
      const answer = await this.#send(call);
      this.writes.push({ at: started, step, call: callLine(call), status: statusOf(answer), ms: performance.now() - started });
      return answer;
    } catch (error) {
      this.writes.push({ at: started, step, call: callLine(call), status: errorStatus(sdkError(error)), ms: performance.now() - started });
      throw error;
    }
  }

  // A delete, a cancel, or an expire: an answer of 404 means that the object is already gone.
  public async remove(step: string, call: StripeCall<unknown>, signal: AbortSignal): Promise<Removal> {
    try {
      await this.write(step, call, signal);
      return 'deleted';
    } catch (error) {
      if (isMissing(error)) return 'gone';
      throw error;
    }
  }

  async #send<Result>(call: StripeCall<Result>): Promise<Result> {
    let answer: Result;
    try {
      answer = await call.send(this.#stripe);
    } catch (error) {
      throw new Error(errorText(call, error), { cause: error });
    }
    refuseLiveObject(call, answer);
    return answer;
  }
}

export const STRIPE_SDK = { version: Stripe.PACKAGE_VERSION, apiVersion: Stripe.API_VERSION };
