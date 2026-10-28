import type { SystemLog } from '../logs/system/system-logger.ts';

const LINE_INTERVAL_MS = 60_000;
// An error code, such as ECONNREFUSED or DEPTH_ZERO_SELF_SIGNED_CERT, holds no part of the request.
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
// The fixed messages of the SDK for a failed export. They hold no part of the request either.
const SDK_FAILURES: ReadonlyMap<string, string> = new Map([
  ['Request timed out', 'no answer in time'],
  ['Timeout', 'no answer in time'],
  ['Export failed with retryable status', 'HTTP 429, 502, 503, or 504 after the retries'],
]);

/**
 * The failure line of the system log export (SO-11a): at most one line a minute on standard error. The next line
 * counts the failures that had no line of their own, so that a failure stays visible without a flood of lines.
 */
export class ExportFailureLine {
  readonly #log: Pick<SystemLog, 'error'>;
  readonly #now: () => number;
  #lineAt = Number.NEGATIVE_INFINITY;
  #withoutLine = 0;

  constructor(log: Pick<SystemLog, 'error'>, now: () => number) {
    this.#log = log;
    this.#now = now;
  }

  report(failure: unknown): void {
    this.#write(causeOf(failure));
  }

  // The stop waited for the export until its bound.
  reportStopBound(): void {
    this.#write('no end within the bound of 5 s at the stop');
  }

  #write(cause: string): void {
    const now = this.#now();
    // A failure within a minute of the last line gets no line of its own.
    if (now - this.#lineAt < LINE_INTERVAL_MS) {
      this.#withoutLine += 1;
      return;
    }
    const count = this.#withoutLine === 0 ? '' : ` Failed exports since the last line: ${this.#withoutLine}.`;
    this.#lineAt = now;
    this.#withoutLine = 0;
    this.#log.error(`System log export failed: ${cause}. The records of that export are dropped.${count}`);
  }
}

// The HTTP status or the error code, never an error message or a body: they can repeat a part of the request.
function causeOf(failure: unknown): string {
  if (!(failure instanceof Error)) return 'an unknown failure';
  return codeOf((failure as { readonly code?: unknown }).code) ?? SDK_FAILURES.get(failure.message) ?? failure.name;
}

// An HTTP status, or an error code such as ECONNREFUSED.
function codeOf(code: unknown): string | undefined {
  if (typeof code === 'number') return `HTTP ${code}`;
  return typeof code === 'string' && ERROR_CODE.test(code) ? code : undefined;
}
