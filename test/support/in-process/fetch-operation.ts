import { ProcessHtmlStep } from '../../../src/pipelines/html-processing/process-html-step.ts';
import type { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { createGetURLAsMarkdown, type FetchOperation } from '../../../src/interfaces/mcp/get-url-as-markdown.ts';
import { createFetchPage } from '../../../src/pipelines/page-fetch/fetch-page.ts';
import { ObserveRequestStep } from '../../../src/pipelines/execution/observe-request-step.ts';
import type { OutgoingStep, IncomingStep } from '../../../src/pipelines/execution/pipeline-step.ts';
import type { StepRecordSink } from '../../../src/pipelines/execution/step-record.ts';
import type { RendererFailureReports } from '../../../src/pipelines/providers/website-fetcher/renderer-failure-reports.ts';
import type { WebsiteFetcher } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';

export function composeFetchOperation({ pipeline, outgoing = new ObserveRequestStep(), incoming = new ProcessHtmlStep(pipeline), ...dependencies }: RendererFailureReports & {
  fetcher: WebsiteFetcher;
  pipeline: Pick<HtmlToMarkdownPipeline, 'process'>;
  outgoing?: OutgoingStep;
  incoming?: IncomingStep;
  records: StepRecordSink;
}): FetchOperation {
  return createGetURLAsMarkdown(createFetchPage({ ...dependencies, outgoing, incoming }));
}
