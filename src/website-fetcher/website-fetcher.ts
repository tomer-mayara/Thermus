export interface WebsiteFetchResult {
  requestedUrl: string;
  finalUrl: string;
  html: string;
}

export interface WebsiteFetcher {
  /**
   * @throws {WebsiteFetchHttpError} If the HTTP response fails.
   * @throws {WebsiteFetchLaunchError} If the renderer cannot start.
   */
  fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult>;
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
