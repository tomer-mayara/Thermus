import { processDiagnostic, safeProcessCode, WebsiteFetchFailure, type FetchDiagnostic } from './fetch-diagnostic.ts';
export { WebsiteFetchFailure, type FetchDiagnostic } from './fetch-diagnostic.ts';
export interface WebsiteFetchResult {
  requestedUrl: string;
  finalUrl: string;
  html: string;
}

export interface WebsiteFetcher {
  /**
   * @throws {WebsiteFetchHttpError} If the HTTP response fails.
   * @throws {WebsiteFetchLaunchError} If the renderer cannot start.
   * @throws {WebsiteFetchReadinessTimeoutError} If the renderer is not ready in twenty seconds.
   */
  fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult>;
}

export const WEBSITE_FETCH_READINESS_BUDGET_MS = 20_000;

export class WebsiteFetchReadinessTimeoutError extends WebsiteFetchFailure {
  public readonly category = 'readiness_timeout';
  public readonly budgetMs = WEBSITE_FETCH_READINESS_BUDGET_MS;

  public constructor(options?: ErrorOptions, diagnostic: FetchDiagnostic = { category: 'readiness_timeout', phase: 'renderer_process', budgetMs: WEBSITE_FETCH_READINESS_BUDGET_MS }) {
    super(`Lightpanda readiness limit exceeded after ${WEBSITE_FETCH_READINESS_BUDGET_MS} ms`, diagnostic, options);
    this.name = 'WebsiteFetchReadinessTimeoutError';
  }
}

export class WebsiteFetchHttpError extends WebsiteFetchFailure {
  public readonly kind = 'http';

  public constructor(public readonly status: number | undefined, options?: ErrorOptions, diagnostic: FetchDiagnostic = { category: 'http', phase: 'renderer_result', ...(status === undefined ? {} : { httpStatus: status }) }) {
    super(status === undefined ? 'HTTP request failed' : `HTTP request failed with status ${status}`, diagnostic, options);
    this.name = 'WebsiteFetchHttpError';
  }
}

// A report can show a system error name, such as ENOENT. Another value becomes UNKNOWN.
export function systemErrorName(code: unknown): string {
  const safe = safeProcessCode(code);
  return safe.startsWith('E') && safe !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? safe : 'UNKNOWN';
}

// The message shows no requested URL, but the cause can: the process error repeats the renderer arguments.
export class WebsiteFetchLaunchError extends WebsiteFetchFailure {
  public readonly kind = 'launch';
  public readonly code: string;
  public readonly failure: 'missing' | 'cannot-start';

  public constructor(code: unknown, message: string, options?: ErrorOptions) {
    super(message, { category: 'launch', phase: 'renderer_launch', ...processDiagnostic(options?.cause) }, options);
    this.name = 'WebsiteFetchLaunchError';
    this.code = systemErrorName(code);
    this.failure = this.code === 'ENOENT' ? 'missing' : 'cannot-start';
  }
}
