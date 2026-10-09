export interface WebsiteFetchResult {
  requestedUrl: string;
  finalUrl: string;
  html: string;
}

export interface WebsiteFetcher {
  fetchURL(url: string): Promise<WebsiteFetchResult>;
}
