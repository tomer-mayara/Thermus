export abstract class WebsiteFetcher {
  public abstract fetchURL(url: string): Promise<string>;
}
