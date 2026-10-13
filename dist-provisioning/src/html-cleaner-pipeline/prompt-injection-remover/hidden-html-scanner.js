import { resolveElementVisibility, REPORTED_TAGS } from 'agent-input-sanitizer/html';
import { html, serializeOuter } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { resolveCssVisibility } from './css-visibility.js';
import { SourceHtmlDocument } from './css-visibility-tree.js';
import { CssVisibilityProvenance } from './css-visibility-provenance.js';
import { HiddenHtmlRemovalCounts } from './hidden-html-removal-counts.js';
import { SmallTextPolicy } from './small-text-policy.js';
export class HiddenHtmlScanner {
    styles;
    tree;
    static exfilTagsToPreserve = new Set(['img', 'meta']);
    static inlineTextTags = new Set([
        'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'ins',
        'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
    ]);
    static excludedTextTags = new Set([
        'head', 'script', 'style', 'template', 'textarea', 'title', 'noscript',
    ]);
    rootSize = null;
    ranges = [];
    removals;
    warned = { tags: {}, dataSrc: 0 };
    urlSources = [];
    hiddenNodes = [];
    visibleSources = new Set();
    visibleNodes = new Set();
    visibleStyles = new Map();
    visibleStyleValues = [];
    textRuns = [];
    textRun = [];
    textAvailable = true;
    captureText;
    smallText;
    constructor(styles, tree, { captureText = false, smallText = new SmallTextPolicy() } = {}) {
        this.styles = styles;
        this.tree = tree;
        this.captureText = captureText;
        this.smallText = smallText;
        this.removals = new HiddenHtmlRemovalCounts(tree);
    }
    static scan(text, provenance = new CssVisibilityProvenance(), options = {}) {
        const tree = SourceHtmlDocument.parse(text);
        const styles = resolveCssVisibility(tree);
        const contexts = provenance.apply(tree, styles);
        const scanner = new HiddenHtmlScanner(styles, tree, options);
        scanner.visit(tree.document);
        scanner.endTextRun();
        const root = tree.document.children.find(adapter.isElementNode);
        if (root && scanner.hiddenNodes.includes(root)) {
            for (const node of tree.document.children.filter(adapter.isDocumentTypeNode)) {
                scanner.hiddenNodes.push(node);
            }
        }
        for (const node of scanner.hiddenNodes) {
            const count = scanner.ranges.length;
            scanner.recordSource(node);
            if (scanner.ranges.length > count)
                scanner.removals.recordDeletion(node);
        }
        provenance.retain(contexts, scanner.visibleNodes, scanner.ranges);
        return {
            ranges: scanner.ranges,
            removed: scanner.removals.counts(),
            warned: scanner.warned,
            urlSource: scanner.urlSources.join(''),
            visibleStyles: [...scanner.visibleStyles.values()],
            visibleStyleValues: scanner.visibleStyleValues,
            textRuns: scanner.textRuns,
        };
    }
    visit(node, parent, removalRoot) {
        if (adapter.isElementNode(node) && Object.keys(node.attribs).length > 0) {
            this.urlSources.push(HiddenHtmlScanner.urlSource(node));
        }
        const visibility = removalRoot ? parent : this.nodeVisibility(node, parent);
        const root = removalRoot ?? (this.recordNode(node, visibility) ? node : undefined);
        const textAvailable = this.textAvailable;
        const boundary = this.captureNodeText(node, visibility, root);
        if (root) {
            this.hiddenNodes.push(node);
            this.removals.cover(node, root);
        }
        else if (adapter.isElementNode(node)) {
            this.visibleSources.add(this.tree.sourceElement(node));
            this.visibleNodes.add(node);
        }
        for (const child of HiddenHtmlScanner.childNodes(node))
            this.visit(child, visibility, root);
        if (boundary)
            this.endTextRun();
        this.textAvailable = textAvailable;
    }
    captureNodeText(node, visibility, removalRoot) {
        if (!this.captureText)
            return false;
        const boundary = HiddenHtmlScanner.isTextBoundary(node, visibility, removalRoot);
        this.textAvailable = this.canReadText(node, removalRoot);
        if (boundary)
            this.endTextRun();
        if (this.textAvailable && adapter.isTextNode(node) && !visibility?.hiddenText) {
            this.textRun.push({ text: node.data, ranges: this.tree.textRanges(node) });
        }
        return boundary;
    }
    static isTextBoundary(node, visibility, removalRoot) {
        return Boolean(removalRoot) || adapter.isCommentNode(node)
            || adapter.isElementNode(node) && (!HiddenHtmlScanner.inlineTextTags.has(node.name)
                || visibility?.display != null && !['inline', 'contents'].includes(visibility.display));
    }
    canReadText(node, removalRoot) {
        return this.textAvailable && !removalRoot && !(adapter.isElementNode(node)
            && (node.namespace !== html.NS.HTML || HiddenHtmlScanner.excludedTextTags.has(node.name)));
    }
    endTextRun() {
        if (this.textRun.length === 0)
            return;
        this.textRuns.push(this.textRun);
        this.textRun = [];
    }
    nodeVisibility(node, parent) {
        return adapter.isElementNode(node) ? this.elementVisibility(node, parent) : parent;
    }
    static childNodes(node) {
        if (adapter.isElementNode(node) && node.name === 'template') {
            return adapter.getTemplateContent(node).children;
        }
        return 'children' in node ? node.children : [];
    }
    elementVisibility(node, parent) {
        const visibility = resolveElementVisibility({
            type: 'element', tagName: node.name, namespace: node.namespace,
            properties: {
                type: node.attribs.type ?? '', value: node.attribs.value ?? '',
                style: this.styles.get(node) ?? node.attribs.style ?? '',
            },
        }, parent, {
            rootSize: this.rootSize,
            quirksMode: this.tree.document['x-mode'] === 'quirks',
        });
        if (!parent && node.name === 'html' && node.namespace === html.NS.HTML) {
            this.rootSize = visibility.fontSize;
        }
        return this.smallText.apply(node, visibility);
    }
    recordNode(node, visibility) {
        if (adapter.isCommentNode(node)) {
            if (adapter.getNodeSourceCodeLocation(node) == null)
                throw new Error('HTML comment has no source range');
            this.removals.add(node, 'comments');
            return true;
        }
        if (adapter.isTextNode(node) && node.data.trim() && visibility?.hiddenText) {
            if (adapter.getNodeSourceCodeLocation(node) == null)
                throw new Error('Hidden HTML text has no source range');
            this.removals.add(node, 'hidden');
            return true;
        }
        if (!adapter.isElementNode(node))
            return false;
        return this.recordElement(node, visibility);
    }
    recordElement(node, visibility) {
        if (Object.hasOwn(node.attribs, 'hidden') || visibility?.hiddenElement) {
            if (adapter.getNodeSourceCodeLocation(node) == null && !visibility?.hiddenElement) {
                throw new Error('Hidden HTML element has no source range');
            }
            this.removals.add(node, 'hidden');
            return true;
        }
        if (HiddenHtmlScanner.hasHiddenContent(node, visibility)) {
            this.removals.add(node, 'hidden');
            return true;
        }
        this.recordVisibleElement(node);
        return false;
    }
    static hasHiddenContent(node, visibility) {
        if (!visibility || !adapter.getNodeSourceCodeLocation(node))
            return false;
        return visibility.hiddenReplacedContent;
    }
    recordVisibleElement(node) {
        if (this.styles.has(node))
            this.recordVisibleStyles(node);
        if (REPORTED_TAGS.has(node.name)) {
            this.warned.tags[node.name] = (this.warned.tags[node.name] ?? 0) + 1;
        }
        if (node.attribs.src?.startsWith('data:'))
            this.warned.dataSrc++;
    }
    recordVisibleStyles(node) {
        for (const { range, decodedValues } of this.tree.styleSources(node)) {
            this.visibleStyles.set(range.start, range);
            this.visibleStyleValues.push(...decodedValues);
        }
    }
    recordSource(node) {
        if (adapter.isTextNode(node)) {
            for (const range of this.tree.textRanges(node))
                this.ranges.push(range);
            return;
        }
        if (adapter.isElementNode(node)) {
            this.recordElementSource(node);
            return;
        }
        const location = adapter.getNodeSourceCodeLocation(node);
        if (location)
            this.ranges.push({ start: location.startOffset, end: location.endOffset });
    }
    recordElementSource(node) {
        if (this.visibleSources.has(this.tree.sourceElement(node)))
            return;
        for (const range of this.tree.elementTagRanges(node))
            this.ranges.push(range);
    }
    static urlSource(node) {
        // The URL detector skips document elements and template contents.
        const tag = HiddenHtmlScanner.exfilTagsToPreserve.has(node.name) ? node.name : 'div';
        const element = adapter.createElement(tag, html.NS.HTML, adapter.getAttrList(node));
        return serializeOuter(element, { treeAdapter: adapter });
    }
}
//# sourceMappingURL=hidden-html-scanner.js.map