import { API_BASE, callLine, PRODUCTION_SERVICE_ID, SERVICE_PREFIX, type Call } from './calls.ts';
import { sleep } from './polls.ts';

export interface RateLimits {
  readonly limit?: string;
  readonly remaining?: string;
  readonly reset?: string;
  readonly retryAfter?: string;
}

export interface Answer {
  readonly status: number;
  readonly json: unknown;
  readonly ms: number;
  readonly limits: RateLimits;
}

export interface WriteRecord {
  readonly step: string;
  readonly call: string;
  readonly status: string;
  readonly ms: number;
  readonly limits: RateLimits;
}

interface RepeatOptions {
  readonly step?: string;
  readonly goneIsDone?: boolean;
}

type Outcome = { readonly answer: Answer } | { readonly answer?: undefined; readonly failure: unknown; readonly retry: boolean; readonly delayMs: number };

const REQUEST_TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const RETRY_MS = 5_000;
const MAX_RETRY_AFTER_MS = 60_000;
const MESSAGE_LIMIT = 300;

export class RenderClient {
  readonly #key: string;
  readonly #writesAllowed: boolean;
  readonly #ownServices = new Set<string>();
  public readonly writes: WriteRecord[] = [];
  public reads = 0;
  public lastReadLimits: RateLimits = {};

  public constructor(key: string, writesAllowed: boolean) {
    this.#key = key;
    this.#writesAllowed = writesAllowed;
  }

  public async read(call: Call, signal: AbortSignal): Promise<Answer> {
    if (call.method !== 'GET') throw new Error(`${callLine(call)} is a write, not a read`);
    const answer = await this.repeat(call, signal, {});
    this.reads += 1;
    this.lastReadLimits = answer.limits;
    return answer;
  }

  // No repeat: a repeated create or deploy can double its effect.
  public async write(step: string, call: Call, signal: AbortSignal): Promise<Answer> {
    this.refuseWhenReadOnly(call);
    const answer = await this.recorded(step, call, signal);
    if (answer.status >= 400) throw apiError(call, answer);
    return answer;
  }

  public async remove(step: string, call: Call, signal: AbortSignal): Promise<Answer> {
    this.refuseWhenReadOnly(call);
    return this.repeat(call, signal, { step, goneIsDone: true });
  }

  private refuseWhenReadOnly(call: Call): void {
    if (!this.#writesAllowed) throw new Error(`${callLine(call)} refused: this run makes reads only`);
  }

  public confirmOwnService(id: string, name: string | undefined): void {
    if (id === PRODUCTION_SERVICE_ID || name?.startsWith(SERVICE_PREFIX) !== true) {
      throw new Error(`The service ${id} (${name ?? 'no name'}) is not a ${SERVICE_PREFIX}* service. The probe touches no other service. Check it in the Render Dashboard.`);
    }
    this.#ownServices.add(id);
  }

  private refuseOtherService(call: Call): void {
    const id = /^\/services\/([^/?]+)/.exec(call.path)?.[1];
    if (id !== undefined && (id === PRODUCTION_SERVICE_ID || !this.#ownServices.has(id))) {
      throw new Error(`${callLine(call)} refused: the probe touches only the ${SERVICE_PREFIX}* service of this run`);
    }
  }

  private async repeat(call: Call, signal: AbortSignal, options: RepeatOptions): Promise<Answer> {
    let failure: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const outcome = await this.attempt(call, signal, options);
      if (outcome.answer !== undefined) return outcome.answer;
      failure = outcome.failure;
      if (!outcome.retry || attempt === ATTEMPTS) break;
      await sleep(outcome.delayMs, signal);
    }
    throw failure;
  }

  private async attempt(call: Call, signal: AbortSignal, options: RepeatOptions): Promise<Outcome> {
    try {
      const answer = options.step === undefined ? await this.send(call, signal) : await this.recorded(options.step, call, signal);
      if (answer.status < 400 || (options.goneIsDone === true && answer.status === 404)) return { answer };
      return { failure: apiError(call, answer), retry: retryable(answer.status), delayMs: retryDelay(answer.limits) };
    } catch (error) {
      if (signal.aborted) throw error;
      return { failure: error, retry: true, delayMs: RETRY_MS };
    }
  }

  private async recorded(step: string, call: Call, signal: AbortSignal): Promise<Answer> {
    const started = performance.now();
    try {
      const answer = await this.send(call, signal);
      this.writes.push({ step, call: callLine(call), status: String(answer.status), ms: answer.ms, limits: answer.limits });
      return answer;
    } catch (error) {
      this.writes.push({ step, call: callLine(call), status: 'no answer', ms: performance.now() - started, limits: {} });
      throw error;
    }
  }

  private async send(call: Call, signal: AbortSignal): Promise<Answer> {
    this.refuseOtherService(call);
    const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${this.#key}` };
    if (call.body !== undefined) headers['Content-Type'] = 'application/json';
    const started = performance.now();
    try {
      const response = await fetch(`${API_BASE}${call.path}`, {
        method: call.method,
        headers,
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
      const text = await response.text();
      return { status: response.status, json: parseJson(text), ms: performance.now() - started, limits: rateLimits(response.headers) };
    } catch (error) {
      throw new Error(`${callLine(call)} got no answer: ${causeOf(error)}`, { cause: error });
    }
  }
}

function rateLimits(headers: Headers): RateLimits {
  const value = (name: string): string | undefined => headers.get(name) ?? undefined;
  return {
    limit: value('ratelimit-limit') ?? value('rate-limit'),
    remaining: value('ratelimit-remaining'),
    reset: value('ratelimit-reset'),
    retryAfter: value('retry-after'),
  };
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(limits: RateLimits): number {
  const seconds = Number(limits.retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS) : RETRY_MS;
}

function apiError(call: Call, answer: Answer): Error {
  const record = typeof answer.json === 'object' && answer.json !== null ? answer.json as Record<string, unknown> : {};
  const message = typeof record.message === 'string' ? `: ${record.message.slice(0, MESSAGE_LIMIT)}` : '';
  const retry = answer.limits.retryAfter === undefined ? '' : ` (Retry-After ${answer.limits.retryAfter} s)`;
  return new Error(`${callLine(call)} answered ${answer.status}${message}${retry}`);
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function causeOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${message}${cause}`;
}
