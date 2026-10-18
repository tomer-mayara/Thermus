import type { PageProcessor } from '../page-fetch/page-processor.ts';
import type { WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';
import { assertHtmlInputSize } from './html-input-limit.ts';
import type { HtmlToMarkdownPipeline } from './html-to-markdown-pipeline.ts';

export class HtmlPageProcessor implements PageProcessor {
  public constructor(private readonly pipeline: Pick<HtmlToMarkdownPipeline, 'process'>) {}

  public async process(page: WebsiteFetchResult, signal: AbortSignal): Promise<string> {
    assertHtmlInputSize(page.html);
    const result = await this.pipeline.process(page, signal);
    if (typeof result?.markdown !== 'string') throw new Error('Page processing failed');
    return result.markdown;
  }
}
