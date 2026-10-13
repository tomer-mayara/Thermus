import adblockRust from 'adblock-rs';
import { selectAll } from 'css-select';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import {} from '../../html-to-markdown-pipeline.js';
import {} from '../clean-html-ads.js';
import { HtmlDepthLimitError, MAX_HTML_ELEMENT_DEPTH } from '../html-depth-limit-error.js';
import { expandLoneLineRanges } from './source-line-index.js';
import { SourceRangeParser } from './source-range-parser.js';
export class CleanHtmlAdsAdblockRs {
    engine;
    constructor(rules) {
        if (typeof rules !== 'string') {
            throw new TypeError('Ad rules must be supplied as a string');
        }
        const filterSet = new adblockRust.FilterSet(false);
        filterSet.addFilters(rules);
        this.engine = new adblockRust.Engine(filterSet);
    }
    async invoke(ctx) {
        const document = CleanHtmlAdsAdblockRs.parseHtml(ctx.html);
        const selected = this.selectorsFor(ctx.finalUrl, document);
        const stripped = CleanHtmlAdsAdblockRs.stripHtml(ctx.html, document, selected.hide);
        return {
            ...ctx,
            html: stripped.html,
            removed: ctx.removed + stripped.removed,
            skipped: ctx.skipped + selected.skipped + stripped.skipped,
        };
    }
    static parseHtml(html) {
        return SourceRangeParser.parse(html, {
            treeAdapter: adapter,
            sourceCodeLocationInfo: true,
            scriptingEnabled: false,
        });
    }
    static *nodesWithinDepth(document) {
        const pending = [{ node: document, depth: 0 }];
        for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
            const { node } = current;
            const depth = current.depth + (adapter.isElementNode(node) ? 1 : 0);
            if (depth > MAX_HTML_ELEMENT_DEPTH) {
                throw new HtmlDepthLimitError();
            }
            yield node;
            if ('children' in node) {
                for (let index = node.children.length - 1; index >= 0; index--) {
                    pending.push({ node: node.children[index], depth });
                }
            }
        }
    }
    static collectClassAndId(document) {
        const classes = new Set();
        const ids = new Set();
        for (const node of CleanHtmlAdsAdblockRs.nodesWithinDepth(document)) {
            if (node.type !== 'tag') {
                continue;
            }
            const id = node.attribs.id;
            if (id !== undefined && id !== '') {
                ids.add(id);
            }
            for (const token of node.attribs.class?.match(/\S+/g) ?? []) {
                classes.add(token);
            }
        }
        return { classes, ids };
    }
    selectorsFor(url, document) {
        const { classes, ids } = CleanHtmlAdsAdblockRs.collectClassAndId(document);
        const specific = this.engine.urlCosmeticResources(url);
        const hide = new Set(specific.hide_selectors);
        if (!specific.generichide) {
            for (const selector of this.engine.hiddenClassIdSelectors([...classes], [...ids], specific.exceptions)) {
                hide.add(selector);
            }
        }
        return { hide: [...hide], skipped: specific.procedural_actions.length };
    }
    static mergeRanges(ranges) {
        const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
        const merged = [];
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
    static removeRanges(html, ranges) {
        const retained = [];
        let offset = 0;
        for (const range of ranges) {
            retained.push(html.slice(offset, range.start));
            offset = range.end;
        }
        retained.push(html.slice(offset));
        return retained.join('');
    }
    static stripHtml(html, document, selectors) {
        const seen = new Set();
        const ranges = [];
        let removed = 0;
        let skipped = 0;
        for (const selector of selectors) {
            let nodes;
            try {
                nodes = selectAll(selector, document);
            }
            catch {
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
                ranges.push({ start: startOffset, end: endOffset });
            }
        }
        const expanded = expandLoneLineRanges(html, ranges);
        return {
            html: removed === 0
                ? html
                : CleanHtmlAdsAdblockRs.removeRanges(html, CleanHtmlAdsAdblockRs.mergeRanges(expanded)),
            removed,
            skipped,
        };
    }
}
//# sourceMappingURL=clean-html-ads-adblock-rs.js.map