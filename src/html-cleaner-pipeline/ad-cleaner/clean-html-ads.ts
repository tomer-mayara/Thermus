export type CleanHtmlAdsResult = {
  html: string;
  removed: number;
  skipped: number;
};

export interface CleanHtmlAds {
  invoke(url: string, html: string): CleanHtmlAdsResult;
}
