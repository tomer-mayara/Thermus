export abstract class CleanHtmlToMarkdown {
  public abstract invoke(html: string): Promise<string>;
}
