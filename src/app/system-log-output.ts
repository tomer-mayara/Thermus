import type { SystemLog, SystemLogRecord, SystemLogSink } from '../logs/system/system-logger.ts';
import { ExportFailureLine } from './system-log-failure-line.ts';

// The stop waits at most this long for the last records, after the HTTP server closed.
const STOP_BOUND_MS = 5_000;

/** An export of the system log: a sink that accepts each record at once, and the stop of the export. */
export interface SystemLogExport {
  readonly sink: SystemLogSink;
  // Sends the waiting records and stops the export.
  close(): Promise<void>;
}

/**
 * The sink of the process (SO-11a). Each record goes to standard error and, after the start of the export, also to the
 * export. A failure of the export never stops the write to standard error and never reaches the caller.
 */
export class SystemLogOutput implements SystemLogSink {
  readonly #standardError: SystemLogSink;
  readonly #failures: ExportFailureLine;
  #export: SystemLogExport | undefined;

  // The failure log writes to standard error only, never to this output, so that a failed export cannot feed itself.
  constructor(standardError: SystemLogSink, failureLog: Pick<SystemLog, 'error'>, now: () => number = () => performance.now()) {
    this.#standardError = standardError;
    this.#failures = new ExportFailureLine(failureLog, now);
  }

  writeSystemLog(record: SystemLogRecord): void {
    // Standard error comes first. A failure there escapes to the caller, as before the export.
    this.#standardError.writeSystemLog(record);
    if (this.#export === undefined) return;
    try {
      this.#export.sink.writeSystemLog(record);
    } catch (failure) {
      this.reportExportFailure(failure);
    }
  }

  /** From now on, each record also goes to the export. */
  startExport(exported: SystemLogExport): void {
    this.#export = exported;
  }

  /** One line on standard error at most once a minute. */
  reportExportFailure(failure: unknown): void {
    this.#failures.report(failure);
  }

  /**
   * Stops the export and waits for it at most 5 s, so that the process stops also when the endpoint does not answer.
   * Later records go to standard error only.
   */
  async close(): Promise<void> {
    const exported = this.#export;
    this.#export = undefined;
    if (exported === undefined) return;
    const stopped = exported.close().catch((failure: unknown) => this.reportExportFailure(failure));
    if (!await settlesWithin(stopped, STOP_BOUND_MS)) this.#failures.reportStopBound();
  }
}

// The timer holds the process until the bound, so that the stop always goes on. False when the bound came first.
async function settlesWithin(work: Promise<void>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const bound = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), ms); });
  try {
    return await Promise.race([work.then(() => true), bound]);
  } finally {
    clearTimeout(timer);
  }
}
