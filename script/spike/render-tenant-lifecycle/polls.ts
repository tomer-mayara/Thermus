export interface PollPlan {
  readonly everyMs: number;
  readonly attempts: number;
}

export const POLLS = {
  deploy: { everyMs: 5_000, attempts: 180 },
  newDeploy: { everyMs: 5_000, attempts: 36 },
  window: { everyMs: 5_000, attempts: 6 },
  state: { everyMs: 5_000, attempts: 60 },
  cleanup: { everyMs: 5_000, attempts: 24 },
} as const satisfies Record<string, PollPlan>;

export interface Wait {
  readonly plan: PollPlan;
  readonly signal: AbortSignal;
  readonly what: string;
}

export async function watch<T>(wait: Wait, read: () => Promise<T | undefined>): Promise<T | undefined> {
  for (let attempt = 1; attempt <= wait.plan.attempts; attempt++) {
    const value = await read();
    if (value !== undefined) return value;
    if (attempt < wait.plan.attempts) await sleep(wait.plan.everyMs, wait.signal);
  }
  return undefined;
}

export async function poll<T>(wait: Wait, read: () => Promise<T | undefined>): Promise<T> {
  const value = await watch(wait, read);
  if (value === undefined) {
    throw new Error(`Timed out after ${wait.plan.attempts} reads every ${wait.plan.everyMs / 1000} s waiting for ${wait.what}`);
  }
  return value;
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(stopped(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(stopped(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function stopped(signal: AbortSignal): Error {
  return new Error(`Stopped by ${typeof signal.reason === 'string' ? signal.reason : 'an abort'}`);
}
