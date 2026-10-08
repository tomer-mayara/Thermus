export interface CleanHtmlToMarkdown {
  invoke(html: string): Promise<string>;
}
