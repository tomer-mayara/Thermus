import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import adblockRust from 'adblock-rs';
import { selectAll } from 'css-select';
import { ElementType, parseDocument } from 'htmlparser2';
import { type Ctx } from '../../html-to-markdown-pipeline.ts';
import { type CleanHtmlAds } from '../clean-html-ads.ts';

type StripHtmlResult = Pick<Ctx, 'html' | 'removed' | 'skipped'>;

type AdblockEngine = InstanceType<typeof adblockRust.Engine>;

type HtmlNode = {
  type?: string;
  attribs?: { class?: string; id?: string };
  children?: HtmlNode[];
  startIndex?: number | null;
  endIndex?: number | null;
};

type SourceRange = {
  start: number;
  end: number;
};

export class CleanHtmlAdsAdblockRs implements CleanHtmlAds {
  private static readonly rulesPath = join(
    process.cwd(),
    'test/unit/fixtures/element-hiding.filters.txt',
  );

  private static engine: AdblockEngine | undefined;

  public async invoke(ctx: Ctx): Promise<Ctx> {
    const document = CleanHtmlAdsAdblockRs.parseHtml(ctx.html);
    const selected = CleanHtmlAdsAdblockRs.selectorsFor(
      CleanHtmlAdsAdblockRs.getEngine(),
      ctx.url,
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

  private static getEngine(): AdblockEngine {
    if (CleanHtmlAdsAdblockRs.engine === undefined) {
      const rules = readFileSync(CleanHtmlAdsAdblockRs.rulesPath, 'utf8');
      const filterSet = new adblockRust.FilterSet(false);
      filterSet.addFilters(rules);
      CleanHtmlAdsAdblockRs.engine = new adblockRust.Engine(filterSet);
    }
    return CleanHtmlAdsAdblockRs.engine;
  }

  private static parseHtml(html: string): HtmlNode {
    return parseDocument(html, { withStartIndices: true, withEndIndices: true }) as HtmlNode;
  }

  private static collectClassAndId(node: HtmlNode, classes: Set<string>, ids: Set<string>): void {
    if (node.type === ElementType.Tag && node.attribs !== undefined) {
      const id = node.attribs.id;
      if (id !== undefined && id !== '') {
        ids.add(id);
      }
      const className = node.attribs.class;
      if (className !== undefined) {
        for (const token of className.split(/\s+/)) {
          if (token !== '') {
            classes.add(token);
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      CleanHtmlAdsAdblockRs.collectClassAndId(child, classes, ids);
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
    const seen = new Set<string>();
    const ranges: SourceRange[] = [];
    let removed = 0;
    let skipped = 0;

    for (const selector of selectors) {
      let nodes: HtmlNode[];
      try {
        nodes = selectAll(selector, document) as HtmlNode[];
      } catch {
        skipped += 1;
        continue;
      }
      for (const node of nodes) {
        if (node.startIndex == null || node.endIndex == null) {
          skipped += 1;
          continue;
        }
        const key = `${node.startIndex}:${node.endIndex}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        removed += 1;
        ranges.push(CleanHtmlAdsAdblockRs.loneLineRange(html, node.startIndex, node.endIndex + 1));
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
