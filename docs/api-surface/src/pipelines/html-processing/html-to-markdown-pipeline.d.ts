import type { WebsiteFetchResult } from '../providers/website-fetcher/website-fetcher.ts';
import type { ScanWithholdingCode } from './prompt-injection-remover/hidden-html-removal-session.ts';
export type HtmlProcessingContext = WebsiteFetchResult & {
    markdown?: string;
    title?: string | null;
    removed: number;
    skipped: number;
    found?: readonly string[];
    warnings?: readonly string[];
    scanWithholding?: ScanWithholdingCode;
};
export interface HtmlTransformation {
    invoke(ctx: HtmlProcessingContext): Promise<HtmlProcessingContext>;
}
export declare class HtmlToMarkdownPipeline {
    private readonly steps;
    constructor(steps: readonly HtmlTransformation[]);
    process(page: WebsiteFetchResult, signal?: AbortSignal): Promise<HtmlProcessingContext>;
}
