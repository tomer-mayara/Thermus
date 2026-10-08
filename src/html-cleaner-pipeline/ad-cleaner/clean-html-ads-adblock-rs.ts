import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import adblockRust from 'adblock-rs';
import { selectAll } from 'css-select';
import { ElementType, parseDocument } from 'htmlparser2';
import { CleanHtmlAds, type CleanHtmlAdsResult } from './clean-html-ads.ts';

const RULES_PATH = join(process.cwd(), 'test/unit/fixtures/element-hiding.filters.txt');

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

let engine: AdblockEngine | undefined;

function getEngine(): AdblockEngine {
  if (engine === undefined) {
    const rules = readFileSync(RULES_PATH, 'utf8');
    const filterSet = new adblockRust.FilterSet(false);
    filterSet.addFilters(rules);
    engine = new adblockRust.Engine(filterSet);
  }
  return engine;
}

function parseHtml(html: string): HtmlNode {
  return parseDocument(html, { withStartIndices: true, withEndIndices: true }) as HtmlNode;
}

function collectClassAndId(node: HtmlNode, classes: Set<string>, ids: Set<string>): void {
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
    collectClassAndId(child, classes, ids);
  }
}

function selectorsFor(adblock: AdblockEngine, url: string, document: HtmlNode): {
  hide: string[];
  skipped: number;
} {
  const specific = adblock.urlCosmeticResources(url);
  const hide = new Set(specific.hide_selectors);
  if (!specific.generichide) {
    const classes = new Set<string>();
    const ids = new Set<string>();
    collectClassAndId(document, classes, ids);
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

function loneLineRange(html: string, start: number, end: number): SourceRange {
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

function mergeRanges(ranges: SourceRange[]): SourceRange[] {
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

function removeRanges(html: string, ranges: SourceRange[]): string {
  let result = html;
  for (const range of [...ranges].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }
  return result;
}

function stripHtml(html: string, document: HtmlNode, selectors: string[]): {
  html: string;
  removed: number;
  skipped: number;
} {
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
      ranges.push(loneLineRange(html, node.startIndex, node.endIndex + 1));
    }
  }

  return {
    html: removed === 0 ? html : removeRanges(html, mergeRanges(ranges)),
    removed,
    skipped,
  };
}

export class CleanHtmlAdsAdblockRs extends CleanHtmlAds {
  public invoke(url: string, html: string): CleanHtmlAdsResult {
    const document = parseHtml(html);
    const selected = selectorsFor(getEngine(), url, document);
    const stripped = stripHtml(html, document, selected.hide);
    return {
      html: stripped.html,
      removed: stripped.removed,
      skipped: selected.skipped + stripped.skipped,
    };
  }
}
