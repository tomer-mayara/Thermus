import { WorkOS } from '@workos-inc/node';
import { callLine, type Call, type WriteRecord } from './calls.ts';
import { redact } from './secrets.ts';
import { sleep } from '../render-tenant-lifecycle/polls.ts';
import type { Removal } from './stripe-client.ts';

export type WorkOSCall<Result> = Call<WorkOS, Result>;

const TIMEOUT_MS = 15_000;
const DELETE_ATTEMPTS = 3;
const RETRY_MS = 3_000;

// The pinned WorkOS SDK puts the HTTP status of a refused call in the status property of its error. The client
// wraps that error, so the status is on the cause.
export function statusOf(error: unknown): number | undefined {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (typeof cause !== 'object' || cause === null || !('status' in cause)) return undefined;
  return typeof cause.status === 'number' ? cause.status : undefined;
}

function requestOf(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('requestID' in error)) return '';
  return typeof error.requestID === 'string' && error.requestID !== '' ? ` (request ${error.requestID})` : '';
}

function errorText(call: WorkOSCall<unknown>, error: unknown): string {
  const status = statusOf(error);
  const message = redact(error instanceof Error ? error.message : String(error));
  return status === undefined ? `${callLine(call)} got no answer: ${message}` : `${callLine(call)} answered HTTP ${status}: ${message}${requestOf(error)}`;
}

export function isGone(error: unknown): boolean {
  return statusOf(error) === 404;
}

function repeatable(error: unknown): boolean {
  const status = statusOf(error);
  return status === undefined || status === 429 || status >= 500;
}

// The WorkOS key reaches every organization of the Staging environment. The probe touches only the objects that it
// created in this run, or that carry the probe prefix in the sweep of earlier runs.
export class WorkOSProbeClient {
  readonly #workos: WorkOS;
  #writesAllowed = false;
  public readonly writes: WriteRecord[] = [];
  public reads = 0;

  public constructor(apiKey: string) {
    // No SDK retry: a repeated create could make a second object. The client repeats only the deletes.
    this.#workos = new WorkOS({ apiKey, maxRetries: 0, timeout: TIMEOUT_MS });
  }

  public allowWrites(): void {
    this.#writesAllowed = true;
  }

  public async read<Result>(call: WorkOSCall<Result>, signal: AbortSignal): Promise<Result> {
    if (call.method !== 'GET') throw new Error(`${callLine(call)} is a write, not a read`);
    signal.throwIfAborted();
    const answer = await this.#send(call);
    this.reads += 1;
    return answer;
  }

  public async write<Result>(step: string, call: WorkOSCall<Result>, signal: AbortSignal): Promise<Result> {
    if (!this.#writesAllowed) throw new Error(`${callLine(call)} refused: the preflight makes reads only`);
    signal.throwIfAborted();
    const started = performance.now();
    try {
      const answer = await this.#send(call);
      this.writes.push({ at: started, step, call: callLine(call), status: 'answered', ms: performance.now() - started });
      return answer;
    } catch (error) {
      this.writes.push({ at: started, step, call: callLine(call), status: String(statusOf(error) ?? 'no answer'), ms: performance.now() - started });
      throw error;
    }
  }

  // Up to 3 attempts after a network failure, a 429, or a 5xx answer. A 404 answer means that the object is gone.
  public async remove(step: string, call: WorkOSCall<unknown>, signal: AbortSignal): Promise<Removal> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.write(step, call, signal);
        return 'deleted';
      } catch (error) {
        if (isGone(error)) return 'gone';
        if (attempt >= DELETE_ATTEMPTS || !repeatable(error)) throw error;
        await sleep(RETRY_MS, signal);
      }
    }
  }

  async #send<Result>(call: WorkOSCall<Result>): Promise<Result> {
    try {
      return await call.send(this.#workos);
    } catch (error) {
      throw new Error(errorText(call, error), { cause: error });
    }
  }
}
