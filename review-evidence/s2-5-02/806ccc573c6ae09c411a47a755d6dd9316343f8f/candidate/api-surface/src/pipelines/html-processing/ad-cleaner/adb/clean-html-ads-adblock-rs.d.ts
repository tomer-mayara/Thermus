import { type HtmlProcessingContext } from '../../html-to-markdown-pipeline.ts';
import { type CleanHtmlAds } from '../clean-html-ads.ts';
export declare class CleanHtmlAdsAdblockRs implements CleanHtmlAds {
    private readonly engine;
    constructor(rules: string);
    invoke(ctx: HtmlProcessingContext): Promise<HtmlProcessingContext>;
    private static parseHtml;
    private static nodesWithinDepth;
    private static collectClassAndId;
    private selectorsFor;
    private static mergeRanges;
    private static removeRanges;
    private static stripHtml;
}
