import { HtmlPageProcessor } from '../../../src/html-cleaner-pipeline/html-page-processor.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { createGetURLAsMarkdown, type FetchOperation } from '../../../src/mcp/get-url-as-markdown.ts';
import { createFetchPage } from '../../../src/page-fetch/fetch-page.ts';
import { ObserveRequestStep } from '../../../src/page-fetch/observe-request-step.ts';
import type { PipelineStep } from '../../../src/page-fetch/pipeline-step.ts';
import type { StepRecordSink } from '../../../src/page-fetch/step-record.ts';
import type { RendererFailureReports } from '../../../src/page-fetch/renderer-failure-reports.ts';
import type { WebsiteFetcher } from '../../../src/website-fetcher/website-fetcher.ts';

export function composeFetchOperation({ pipeline, outgoing = new ObserveRequestStep(), ...dependencies }: RendererFailureReports & {
  fetcher: WebsiteFetcher;
  pipeline: Pick<HtmlToMarkdownPipeline, 'process'>;
  outgoing?: PipelineStep<string, string>;
  records: StepRecordSink;
}): FetchOperation {
  return createGetURLAsMarkdown(createFetchPage({ ...dependencies, outgoing, processor: new HtmlPageProcessor(pipeline) }));
}
