import type { WebsiteFetchResult } from '../providers/website-fetcher/website-fetcher.ts';
import type { ScanWithholdingCode } from './prompt-injection-remover/hidden-html-removal-session.ts';

export type HtmlProcessingContext = WebsiteFetchResult & {
  markdown?: string;
  title?: string | null;
  removed: number;
  skipped: number;
  // Detection categories in first-seen order, without duplicates. Count with Set.size.
  found?: readonly string[];
  warnings?: readonly string[];
  scanWithholding?: ScanWithholdingCode;
};

export interface HtmlTransformation {
  invoke(ctx: HtmlProcessingContext): Promise<HtmlProcessingContext>;
}

export class HtmlToMarkdownPipeline {
  public constructor(private readonly steps: readonly HtmlTransformation[]) {}

  public async process(page: WebsiteFetchResult, signal?: AbortSignal): Promise<HtmlProcessingContext> {
    let ctx: HtmlProcessingContext = { ...page, removed: 0, skipped: 0 };
    for (const step of this.steps) {
      signal?.throwIfAborted();
      ctx = await step.invoke(ctx);
    }
    signal?.throwIfAborted();
    return ctx;
  }
}
