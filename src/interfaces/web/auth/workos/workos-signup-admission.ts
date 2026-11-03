import { waitForRequest } from '../../../../runtime/http/request-cancellation.ts';
import { signupFailurePage } from './workos-signup-pages.ts';
import type { RequestOperation } from './workos-signup-tenants.ts';

/** The POSTs that can hold a slot at one time. */
const MAX_CONCURRENT_POSTS = 8;
/** The keys that the table keeps. A full table refuses a new key until an entry expires. */
const MAX_KEYS = 1024;
/** The attempts of one key in one window. */
const ATTEMPTS_PER_WINDOW = 3;
/** The length of one window: one minute. */
const WINDOW_SECONDS = 60;

/**
 * The process-local admission of the signup POSTs: eight concurrent POSTs, and three attempts of each key in a minute.
 * The organization form uses the subject as its key. It is not a global provider quota.
 */
export class SignupAdmission {
  /** The attempts of each key in its current window. */
  private readonly attempts = new Map<string, { until: number; count: number }>();
  /** The time in milliseconds. */
  private readonly clock: () => number;
  /** The POSTs that hold a slot now. */
  private pending = 0;

  constructor(clock: () => number) {
    this.clock = clock;
  }

  /** Gives the answer of a POST in a free slot, or undefined when all slots are taken. */
  async inSlot(request: Request, answer: (run: RequestOperation) => Promise<Response>): Promise<Response | undefined> {
    if (this.pending >= MAX_CONCURRENT_POSTS) return undefined;
    this.pending++;
    let outstanding: Promise<unknown> | undefined;
    const run: RequestOperation = (start) => waitForRequest(request.signal, () => {
      const operation = start();
      outstanding = operation;
      return operation;
    });
    try {
      return await answer(run);
    } finally {
      this.release(outstanding);
    }
  }

  /**
   * Frees the slot of a POST. A disconnected request still holds its slot until its last provider operation settles,
   * so that a client cannot start more provider work than the slots allow.
   */
  private release(outstanding: Promise<unknown> | undefined): void {
    if (outstanding === undefined) this.pending--;
    else void outstanding.then(() => { this.pending--; }, () => { this.pending--; });
  }

  /** Counts one attempt of a key. False when the key has no attempt left in its window, or when the table is full. */
  admit(key: string): boolean {
    const now = this.clock();
    for (const [stored, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(stored);
    const prior = this.attempts.get(key);
    if (prior !== undefined) {
      if (prior.count >= ATTEMPTS_PER_WINDOW) return false;
      prior.count++;
      return true;
    }
    if (this.attempts.size >= MAX_KEYS) return false;
    this.attempts.set(key, { until: now + WINDOW_SECONDS * 1_000, count: 1 });
    return true;
  }
}

/** The answer to a POST that the admission refuses: 429, with a new try after one window. */
export function limitedAnswer(): Response {
  const answer = signupFailurePage(429, 'Too many activation requests. Try again later.');
  answer.headers.set('Retry-After', String(WINDOW_SECONDS));
  return answer;
}
