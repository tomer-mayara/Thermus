import { HtmlPageProcessor } from '../../../src/html-cleaner-pipeline/html-page-processor.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { createGetURLAsMarkdown, type FetchOperation } from '../../../src/mcp/get-url-as-markdown.ts';
import { createFetchPage } from '../../../src/page-fetch/fetch-page.ts';
import type { RendererFailureReports } from '../../../src/page-fetch/renderer-failure-reports.ts';
import type { WebsiteFetcher } from '../../../src/website-fetcher/website-fetcher.ts';

export function composeFetchOperation({ pipeline, ...dependencies }: RendererFailureReports & {
  fetcher: WebsiteFetcher;
  pipeline: Pick<HtmlToMarkdownPipeline, 'process'>;
}): FetchOperation {
  return createGetURLAsMarkdown(createFetchPage({ ...dependencies, processor: new HtmlPageProcessor(pipeline) }));
}
