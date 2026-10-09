import { isHiddenElement, REPORTED_TAGS } from 'agent-input-sanitizer/html';
import { html, serializeOuter } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { resolveCssVisibility, type VisibilityStyle } from './css-visibility.ts';
import { parseSourceDocument, type SourceElement, type CssHtmlDocument } from './css-visibility-tree.ts';
import { CssVisibilityProvenance } from './css-visibility-provenance.ts';

type HtmlNode = Htmlparser2TreeAdapterMap['node'];
type HtmlElement = Htmlparser2TreeAdapterMap['element'];

export class HiddenHtmlScanner {
  private static readonly exfilTagsToPreserve = new Set(['img', 'meta']);
  private readonly ranges: { start: number; end: number }[] = [];
  private readonly removed = { comments: 0, hidden: 0 };
  private readonly warned = { tags: {} as Record<string, number>, dataSrc: 0 };
  private readonly urlSources: string[] = [];
  private readonly hiddenNodes: HtmlNode[] = [];
  private readonly visibleSources = new Set<HtmlElement>();
  private readonly visibleNodes = new Set<HtmlElement>();
  private readonly visibleStyles = new Map<number, { start: number; end: number }>();

  private constructor(
    private readonly styles: Map<HtmlElement, VisibilityStyle>,
    private readonly sourceElement: SourceElement,
    private readonly adoptedSources: CssHtmlDocument['adoptedSources'],
  ) {}

  public static scan(text: string, provenance = new CssVisibilityProvenance()) {
    const tree = parseSourceDocument(text);
    const styles = resolveCssVisibility(tree);
    const contexts = provenance.apply(tree, styles);
    const scanner = new HiddenHtmlScanner(styles, tree.sourceElement, tree.adoptedSources);
    scanner.visit(tree.document, false);
    const root = tree.document.children.find(adapter.isElementNode);
    if (root && scanner.hiddenNodes.includes(root)) {
      for (const node of tree.document.children.filter(adapter.isDocumentTypeNode)) {
        scanner.hiddenNodes.push(node);
      }
    }
    for (const node of scanner.hiddenNodes) scanner.recordSource(node);
    provenance.retain(contexts, scanner.visibleNodes, scanner.ranges);
    return {
      ranges: scanner.ranges,
      removed: scanner.removed,
      warned: scanner.warned,
      urlSource: scanner.urlSources.join(''),
      visibleStyles: [...scanner.visibleStyles.values()],
    };
  }

  private visit(node: HtmlNode, removedAncestor: boolean): void {
    if (adapter.isElementNode(node) && Object.keys(node.attribs).length > 0) {
      this.urlSources.push(HiddenHtmlScanner.urlSource(node));
    }
    const removed = removedAncestor || this.recordNode(node);
    if (removed) this.hiddenNodes.push(node);
    else if (adapter.isElementNode(node)) {
      this.visibleSources.add(this.sourceElement(node));
      this.visibleNodes.add(node);
    }
    const children = adapter.isElementNode(node) && node.name === 'template'
      ? adapter.getTemplateContent(node).children
      : 'children' in node ? node.children : [];
    for (const child of children) this.visit(child, removed);
  }

  private recordNode(node: HtmlNode): boolean {
    if (adapter.isCommentNode(node)) {
      if (adapter.getNodeSourceCodeLocation(node) == null) throw new Error('HTML comment has no source range');
      this.removed.comments++;
      return true;
    }
    if (!adapter.isElementNode(node)) return false;
    return this.recordElement(node);
  }

  private recordElement(node: HtmlElement): boolean {
    const css = this.styles.get(node);
    const properties = css === undefined ? node.attribs : { ...node.attribs, style: css };
    if (isHiddenElement({ type: 'element', properties })) {
      if (adapter.getNodeSourceCodeLocation(node) == null && css !== 'display:none') {
        throw new Error('Hidden HTML element has no source range');
      }
      this.removed.hidden++;
      return true;
    }
    this.recordVisibleElement(node, properties, css);
    return false;
  }

  private recordVisibleElement(
    node: HtmlElement, properties: Record<string, string>, css: VisibilityStyle | undefined,
  ): void {
    if (css === '') this.recordVisibleStyles(node);
    if (REPORTED_TAGS.has(node.name)) {
      this.warned.tags[node.name] = (this.warned.tags[node.name] ?? 0) + 1;
    }
    if (properties.src?.startsWith('data:')) this.warned.dataSrc++;
  }

  private recordVisibleStyles(node: HtmlElement): void {
    const locations = [
      adapter.getNodeSourceCodeLocation(this.sourceElement(node)),
      ...this.adoptedSources.get(node) ?? [],
    ];
    for (const location of locations) {
      const style = location?.attrs?.style;
      if (style) this.visibleStyles.set(style.startOffset, { start: style.startOffset, end: style.endOffset });
    }
  }

  private recordSource(node: HtmlNode): void {
    if (adapter.isElementNode(node)) {
      if (this.visibleSources.has(this.sourceElement(node))) return;
      for (const source of this.adoptedSources.get(node) ?? []) {
        this.ranges.push({ start: source.startOffset, end: source.endOffset });
      }
    }
    const location = adapter.getNodeSourceCodeLocation(node);
    if (location == null) return;
    // A whole element interval can also contain visible nodes outside its parsed subtree.
    const sources = adapter.isElementNode(node)
      ? [location.startTag, location.endTag]
      : [location];
    for (const source of sources) {
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
