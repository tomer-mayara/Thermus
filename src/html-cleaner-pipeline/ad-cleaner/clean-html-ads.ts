export type CleanHtmlAdsResult = {
  html: string;
  removed: number;
  skipped: number;
};

export abstract class CleanHtmlAds {
  public abstract invoke(url: string, html: string): CleanHtmlAdsResult;
}
