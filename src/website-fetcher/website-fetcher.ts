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

export class WebsiteFetchReadinessTimeoutError extends Error {
  public readonly category = 'readiness_timeout';
  public readonly budgetMs = WEBSITE_FETCH_READINESS_BUDGET_MS;

  public constructor(options?: ErrorOptions) {
    super(`Lightpanda readiness limit exceeded after ${WEBSITE_FETCH_READINESS_BUDGET_MS} ms`, options);
    this.name = 'WebsiteFetchReadinessTimeoutError';
  }
}

export class WebsiteFetchHttpError extends Error {
  public readonly kind = 'http';

  public constructor(public readonly status: number | undefined, options?: ErrorOptions) {
    super(status === undefined ? 'HTTP request failed' : `HTTP request failed with status ${status}`, options);
    this.name = 'WebsiteFetchHttpError';
  }
}

// A report can show a system error name, such as ENOENT. Another value becomes UNKNOWN.
export function systemErrorName(code: unknown): string {
  return typeof code === 'string' && /^E[A-Z0-9]+$/.test(code) ? code : 'UNKNOWN';
}

// The message shows no requested URL, but the cause can: the process error repeats the renderer arguments.
export class WebsiteFetchLaunchError extends Error {
  public readonly kind = 'launch';
  public readonly code: string;
  public readonly failure: 'missing' | 'cannot-start';

  public constructor(code: unknown, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebsiteFetchLaunchError';
    this.code = systemErrorName(code);
    this.failure = this.code === 'ENOENT' ? 'missing' : 'cannot-start';
  }
}
