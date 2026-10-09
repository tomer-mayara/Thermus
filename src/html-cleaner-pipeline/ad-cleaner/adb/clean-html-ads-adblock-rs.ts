import adblockRust from 'adblock-rs';
import { selectAll } from 'css-select';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { type Ctx } from '../../html-to-markdown-pipeline.ts';
import { type CleanHtmlAds } from '../clean-html-ads.ts';
import { SourceRangeParser } from './source-range-parser.ts';

type StripHtmlResult = Pick<Ctx, 'html' | 'removed' | 'skipped'>;

type AdblockEngine = InstanceType<typeof adblockRust.Engine>;

type HtmlDocument = Htmlparser2TreeAdapterMap['document'];
type HtmlNode = Htmlparser2TreeAdapterMap['node'];

type SourceRange = {
  start: number;
  end: number;
};

export class CleanHtmlAdsAdblockRs implements CleanHtmlAds {
  private readonly engine: AdblockEngine;

  public constructor(rules: string) {
    if (typeof rules !== 'string') {
      throw new TypeError('Ad rules must be supplied as a string');
    }
    const filterSet = new adblockRust.FilterSet(false);
    filterSet.addFilters(rules);
    this.engine = new adblockRust.Engine(filterSet);
  }

  public async invoke(ctx: Ctx): Promise<Ctx> {
    const document = CleanHtmlAdsAdblockRs.parseHtml(ctx.html);
    const selected = CleanHtmlAdsAdblockRs.selectorsFor(
      this.engine,
      ctx.finalUrl,
      document,
    );
    const stripped = CleanHtmlAdsAdblockRs.stripHtml(ctx.html, document, selected.hide);
    return {
      ...ctx,
      html: stripped.html,
      removed: ctx.removed + stripped.removed,
      skipped: ctx.skipped + selected.skipped + stripped.skipped,
    };
  }

  private static parseHtml(html: string): HtmlDocument {
    return SourceRangeParser.parse(html, {
      treeAdapter: adapter,
      sourceCodeLocationInfo: true,
      scriptingEnabled: false,
    });
  }

  private static collectClassAndId(node: HtmlNode, classes: Set<string>, ids: Set<string>): void {
    if ('children' in node) {
      for (const child of node.children) {
        CleanHtmlAdsAdblockRs.collectClassAndId(child, classes, ids);
      }
    }
    if (node.type !== 'tag') {
      return;
    }
    const id = node.attribs.id;
    if (id !== undefined && id !== '') {
      ids.add(id);
    }
    for (const token of node.attribs.class?.match(/\S+/g) ?? []) {
      classes.add(token);
    }
  }

  private static selectorsFor(
    adblock: AdblockEngine,
    url: string,
    document: HtmlNode,
  ): { hide: string[]; skipped: number } {
    const specific = adblock.urlCosmeticResources(url);
    const hide = new Set(specific.hide_selectors);
    if (!specific.generichide) {
      const classes = new Set<string>();
      const ids = new Set<string>();
      CleanHtmlAdsAdblockRs.collectClassAndId(document, classes, ids);
      for (const selector of adblock.hiddenClassIdSelectors(
        [...classes],
        [...ids],
        specific.exceptions,
      )) {
        hide.add(selector);
      }
    }
    return { hide: [...hide], skipped: specific.procedural_actions.length };
  }

  private static loneLineRange(html: string, start: number, end: number): SourceRange {
    const lineStart = html.lastIndexOf('\n', start - 1) + 1;
    const newlineAt = html.indexOf('\n', end);
    const lineContentEnd = newlineAt === -1 ? html.length : newlineAt;
    const before = html.slice(lineStart, start);
    const after = html.slice(end, lineContentEnd);
    if (/^[ \t]*$/.test(before) && /^[ \t]*$/.test(after)) {
      return { start: lineStart, end: newlineAt === -1 ? html.length : newlineAt + 1 };
    }
    return { start, end };
  }

  private static mergeRanges(ranges: SourceRange[]): SourceRange[] {
    const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
    const merged: SourceRange[] = [];
    for (const range of sorted) {
      const last = merged.at(-1);
      if (last !== undefined && range.start <= last.end) {
        last.end = Math.max(last.end, range.end);
        continue;
      }
      merged.push({ start: range.start, end: range.end });
    }
    return merged;
  }

  private static removeRanges(html: string, ranges: SourceRange[]): string {
    let result = html;
    for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
      result = result.slice(0, range.start) + result.slice(range.end);
    }
    return result;
  }

  private static stripHtml(
    html: string,
    document: HtmlNode,
    selectors: string[],
  ): StripHtmlResult {
    const seen = new Set<HtmlNode>();
    const ranges: SourceRange[] = [];
    let removed = 0;
    let skipped = 0;

    for (const selector of selectors) {
      let nodes: HtmlNode[];
      try {
        nodes = selectAll<HtmlNode, HtmlNode>(selector, document);
      } catch {
        skipped += 1;
        continue;
      }
      for (const node of nodes) {
        const location = node.sourceCodeLocation;
        if (location == null) {
          skipped += 1;
          continue;
        }
        const { startOffset, endOffset } = location;
        if (seen.has(node)) {
          continue;
        }
        seen.add(node);
        removed += 1;
        ranges.push(CleanHtmlAdsAdblockRs.loneLineRange(html, startOffset, endOffset));
      }
    }

    return {
      html: removed === 0
        ? html
        : CleanHtmlAdsAdblockRs.removeRanges(html, CleanHtmlAdsAdblockRs.mergeRanges(ranges)),
      removed,
      skipped,
    };
  }
}
