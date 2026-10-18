import type { PipelineStep, StepResult } from '../page-fetch/pipeline-step.ts';
import type { WebsiteFetchResult } from '../website-fetcher/website-fetcher.ts';
import { assertHtmlInputSize } from './html-input-limit.ts';
import type { HtmlToMarkdownPipeline } from './html-to-markdown-pipeline.ts';

export class ProcessHtmlStep implements PipelineStep<WebsiteFetchResult, string> {
  public readonly id = 'incoming.process_html';

  public constructor(private readonly pipeline: Pick<HtmlToMarkdownPipeline, 'process'>) {}

  public async execute(page: WebsiteFetchResult, signal: AbortSignal): Promise<StepResult<string>> {
    assertHtmlInputSize(page.html);
    const result = await this.pipeline.process(page, signal);
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Page processing failed');
    const { scanWithholding } = result;
    if (scanWithholding !== undefined) {
      if (Object.hasOwn(result, 'scanWithholding') && (scanWithholding === 'scan_failed' || scanWithholding === 'scan_limit')) {
        return { decision: 'block', code: scanWithholding };
      }
      throw new Error('Page processing failed');
    }
    const { markdown } = result;
    if (!Object.hasOwn(result, 'markdown') || typeof markdown !== 'string') throw new Error('Page processing failed');
    return { decision: 'allow', output: markdown };
  }
}
