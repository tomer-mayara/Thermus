export const MAX_HTML_ELEMENT_DEPTH = 256;

export class HtmlDepthLimitError extends Error {
  public constructor() {
    super(`HTML input exceeds the ${MAX_HTML_ELEMENT_DEPTH} element depth limit`);
    this.name = 'HtmlDepthLimitError';
  }
}
