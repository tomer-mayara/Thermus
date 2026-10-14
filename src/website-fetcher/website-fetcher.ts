export interface WebsiteFetchResult {
  requestedUrl: string;
  finalUrl: string;
  html: string;
}

export interface WebsiteFetcher {
  /** @throws {WebsiteFetchHttpError} If the HTTP response fails. */
  fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult>;
}

export class WebsiteFetchHttpError extends Error {
  public readonly kind = 'http';

  public constructor(public readonly status: number | undefined, options?: ErrorOptions) {
    super(status === undefined ? 'HTTP request failed' : `HTTP request failed with status ${status}`, options);
    this.name = 'WebsiteFetchHttpError';
  }
}
