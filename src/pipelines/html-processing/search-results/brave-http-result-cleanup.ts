import type { HtmlProcessingContext, HtmlTransformation } from '../html-to-markdown-pipeline.ts';
import { BraveResultDocument } from './brave-result-document.ts';

export class BraveHTTPResultCleanup implements HtmlTransformation {
  public async invoke(ctx: HtmlProcessingContext): Promise<HtmlProcessingContext> {
    if (ctx.scanWithholding === undefined) return new BraveResultDocument(ctx).project();
    if (ctx.scanWithholding !== 'scan_failed' && ctx.scanWithholding !== 'scan_limit') throw new Error('Invalid scan withholding');
    return { ...ctx, html: '' };
  }
}
