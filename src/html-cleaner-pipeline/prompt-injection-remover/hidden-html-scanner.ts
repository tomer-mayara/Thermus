import { resolveElementVisibility, REPORTED_TAGS, type ElementVisibility } from 'agent-input-sanitizer/html';
import { html, serializeOuter } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { resolveCssVisibility, type VisibilityStyle } from './css-visibility.ts';
import { parseSourceDocument, type CssHtmlDocument } from './css-visibility-tree.ts';
import { CssVisibilityProvenance } from './css-visibility-provenance.ts';
import { HiddenHtmlRemovalCounts } from './hidden-html-removal-counts.ts';

type HtmlNode = Htmlparser2TreeAdapterMap['node'];
type HtmlElement = Htmlparser2TreeAdapterMap['element'];
export type VisibleTextSource = { text: string; ranges: readonly { start: number; end: number }[] };

export class HiddenHtmlScanner {
  private static readonly exfilTagsToPreserve = new Set(['img', 'meta']);
  private static readonly inlineTextTags = new Set([
    'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'del', 'dfn', 'em', 'i', 'ins',
    'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
  ]);
  private static readonly excludedTextTags = new Set([
    'head', 'script', 'style', 'template', 'textarea', 'title', 'noscript',
  ]);
  private rootSize: number | null = null;
  private readonly ranges: { start: number; end: number }[] = [];
  private readonly removals: HiddenHtmlRemovalCounts;
  private readonly warned = { tags: {} as Record<string, number>, dataSrc: 0 };
  private readonly urlSources: string[] = [];
  private readonly hiddenNodes: HtmlNode[] = [];
  private readonly visibleSources = new Set<HtmlElement>();
  private readonly visibleNodes = new Set<HtmlElement>();
  private readonly visibleStyles = new Map<number, { start: number; end: number }>();
  private readonly visibleStyleValues: string[] = [];
  private readonly textRuns: VisibleTextSource[][] = [];
  private textRun: VisibleTextSource[] = [];
  private textAvailable = true;

  private constructor(
    private readonly styles: Map<HtmlElement, VisibilityStyle>,
    private readonly tree: CssHtmlDocument,
    private readonly captureText = false,
  ) {
    this.removals = new HiddenHtmlRemovalCounts(tree);
  }

  public static scan(text: string, provenance = new CssVisibilityProvenance(), captureText = false) {
    const tree = parseSourceDocument(text);
    const styles = resolveCssVisibility(tree);
    const contexts = provenance.apply(tree, styles);
    const scanner = new HiddenHtmlScanner(styles, tree, captureText);
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
      if (scanner.ranges.length > count) scanner.removals.recordDeletion(node);
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

  private visit(node: HtmlNode, parent?: ElementVisibility, removalRoot?: HtmlNode): void {
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
    } else if (adapter.isElementNode(node)) {
      this.visibleSources.add(this.tree.sourceElement(node));
      this.visibleNodes.add(node);
    }
    for (const child of HiddenHtmlScanner.childNodes(node)) this.visit(child, visibility, root);
    if (boundary) this.endTextRun();
    this.textAvailable = textAvailable;
  }

  private captureNodeText(node: HtmlNode, visibility?: ElementVisibility, removalRoot?: HtmlNode): boolean {
    if (!this.captureText) return false;
    const boundary = HiddenHtmlScanner.isTextBoundary(node, visibility, removalRoot);
    this.textAvailable = this.canReadText(node, removalRoot);
    if (boundary) this.endTextRun();
    if (this.textAvailable && adapter.isTextNode(node) && !visibility?.hiddenText) {
      this.textRun.push({ text: node.data, ranges: this.tree.textSources.get(node) });
    }
    return boundary;
  }

  private static isTextBoundary(node: HtmlNode, visibility?: ElementVisibility, removalRoot?: HtmlNode): boolean {
    return Boolean(removalRoot) || adapter.isCommentNode(node)
      || adapter.isElementNode(node) && (!HiddenHtmlScanner.inlineTextTags.has(node.name)
        || visibility?.display != null && !['inline', 'contents'].includes(visibility.display));
  }

  private canReadText(node: HtmlNode, removalRoot?: HtmlNode): boolean {
    return this.textAvailable && !removalRoot && !(adapter.isElementNode(node)
      && (node.namespace !== html.NS.HTML || HiddenHtmlScanner.excludedTextTags.has(node.name)));
  }

  private endTextRun(): void {
    if (this.textRun.length === 0) return;
    this.textRuns.push(this.textRun);
    this.textRun = [];
  }

  private nodeVisibility(node: HtmlNode, parent?: ElementVisibility): ElementVisibility | undefined {
    return adapter.isElementNode(node) ? this.elementVisibility(node, parent) : parent;
  }

  private static childNodes(node: HtmlNode): HtmlNode[] {
    if (adapter.isElementNode(node) && node.name === 'template') {
      return adapter.getTemplateContent(node).children;
    }
    return 'children' in node ? node.children : [];
  }

  private elementVisibility(node: HtmlElement, parent?: ElementVisibility): ElementVisibility {
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
    return visibility;
  }

  private recordNode(node: HtmlNode, visibility?: ElementVisibility): boolean {
    if (adapter.isCommentNode(node)) {
      if (adapter.getNodeSourceCodeLocation(node) == null) throw new Error('HTML comment has no source range');
      this.removals.add(node, 'comments');
      return true;
    }
    if (adapter.isTextNode(node) && node.data.trim() && visibility?.hiddenText) {
      if (adapter.getNodeSourceCodeLocation(node) == null) throw new Error('Hidden HTML text has no source range');
      this.removals.add(node, 'hidden');
      return true;
    }
    if (!adapter.isElementNode(node)) return false;
    return this.recordElement(node, visibility);
  }

  private recordElement(node: HtmlElement, visibility?: ElementVisibility): boolean {
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

  private static hasHiddenContent(node: HtmlElement, visibility?: ElementVisibility): boolean {
    if (!visibility || !adapter.getNodeSourceCodeLocation(node)) return false;
    return visibility.hiddenReplacedContent;
  }

  private recordVisibleElement(node: HtmlElement): void {
    if (this.styles.has(node)) this.recordVisibleStyles(node);
    if (REPORTED_TAGS.has(node.name)) {
      this.warned.tags[node.name] = (this.warned.tags[node.name] ?? 0) + 1;
    }
    if (node.attribs.src?.startsWith('data:')) this.warned.dataSrc++;
  }

  private recordVisibleStyles(node: HtmlElement): void {
    const locations = [
      adapter.getNodeSourceCodeLocation(this.tree.sourceElement(node)),
      ...this.tree.adoptedSources.get(node) ?? [],
    ];
    for (const location of locations) {
      const style = location?.attrs?.style;
      if (!style) continue;
      this.visibleStyles.set(style.startOffset, { start: style.startOffset, end: style.endOffset });
      this.visibleStyleValues.push(...this.tree.decodedStyleValues.get(style.startOffset) ?? []);
    }
  }

  private recordSource(node: HtmlNode): void {
    if (adapter.isTextNode(node)) {
      for (const range of this.tree.textSources.get(node)) this.ranges.push(range);
      return;
    }
    if (adapter.isElementNode(node)) {
      this.recordElementSource(node);
      return;
    }
    const location = adapter.getNodeSourceCodeLocation(node);
    if (location) this.ranges.push({ start: location.startOffset, end: location.endOffset });
  }

  private recordElementSource(node: HtmlElement): void {
    if (this.visibleSources.has(this.tree.sourceElement(node))) return;
    for (const source of this.tree.adoptedSources.get(node) ?? []) {
      this.ranges.push({ start: source.startOffset, end: source.endOffset });
    }
    const location = adapter.getNodeSourceCodeLocation(node);
    if (location == null) return;
    // A whole element interval can also contain visible nodes outside its parsed subtree.
    for (const source of [location.startTag, location.endTag]) {
      if (source) this.ranges.push({ start: source.startOffset, end: source.endOffset });
    }
  }

  private static urlSource(node: HtmlElement): string {
    // The URL detector skips document elements and template contents.
    const tag = HiddenHtmlScanner.exfilTagsToPreserve.has(node.name) ? node.name : 'div';
    const element = adapter.createElement(tag, html.NS.HTML, adapter.getAttrList(node));
    return serializeOuter(element, { treeAdapter: adapter });
  }
}
