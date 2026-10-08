export interface WebsiteFetcher {
  fetchURL(url: string): Promise<string>;
}
