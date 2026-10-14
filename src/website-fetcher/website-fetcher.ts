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

// The renderer did not start. The code is the system error code, such as ENOENT for a missing executable or EACCES
// for one that cannot start. The message shows no requested URL, but the cause can.
export class WebsiteFetchLaunchError extends Error {
  public readonly kind = 'launch';
  public readonly failure: 'missing' | 'cannot-start';

  public constructor(public readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WebsiteFetchLaunchError';
    this.failure = code === 'ENOENT' ? 'missing' : 'cannot-start';
  }
}
