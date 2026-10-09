import { isHiddenElement, REPORTED_TAGS } from 'agent-input-sanitizer/html';
import { html, serializeOuter } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { resolveCssVisibility, type VisibilityStyle } from './css-visibility.ts';
import { parseSourceDocument, type SourceElement } from './css-visibility-tree.ts';

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
  private readonly visibleStyles = new Map<number, { start: number; end: number }>();

  private constructor(
    private readonly styles: Map<HtmlElement, VisibilityStyle>,
    private readonly sourceElement: SourceElement,
  ) {}

  public static scan(text: string) {
    const tree = parseSourceDocument(text);
    const scanner = new HiddenHtmlScanner(resolveCssVisibility(tree), tree.sourceElement);
    scanner.visit(tree.document, false);
    const root = tree.document.children.find(adapter.isElementNode);
    if (root && scanner.hiddenNodes.includes(root)) {
      for (const node of tree.document.children.filter(adapter.isDocumentTypeNode)) {
        scanner.hiddenNodes.push(node);
      }
    }
    for (const node of scanner.hiddenNodes) scanner.recordSource(node);
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
    else if (adapter.isElementNode(node)) this.visibleSources.add(this.sourceElement(node));
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
    const style = adapter.getNodeSourceCodeLocation(this.sourceElement(node))?.attrs?.style;
    if (css === '' && style) {
      this.visibleStyles.set(style.startOffset, { start: style.startOffset, end: style.endOffset });
    }
    if (REPORTED_TAGS.has(node.name)) {
      this.warned.tags[node.name] = (this.warned.tags[node.name] ?? 0) + 1;
    }
    if (properties.src?.startsWith('data:')) this.warned.dataSrc++;
  }

  private recordSource(node: HtmlNode): void {
    const location = adapter.getNodeSourceCodeLocation(node);
    if (location == null) return;
    if (adapter.isElementNode(node) && this.visibleSources.has(this.sourceElement(node))) return;
    // A visible reconstructed copy can still use the original source tags.
    // Remove each hidden tag and text range without changing other source text.
    const sources = adapter.isElementNode(node)
      ? [location.startTag, location.endTag]
      : [location];
    for (const source of sources) {
      if (source) this.ranges.push({ start: source.startOffset, end: source.endOffset });
    }
  }

  private static urlSource(node: HtmlElement): string {
    // The URL detector skips document elements and template contents.
    // Separate attribute sources keep these URLs visible to that detector.
    const tag = HiddenHtmlScanner.exfilTagsToPreserve.has(node.name) ? node.name : 'div';
    const element = adapter.createElement(tag, html.NS.HTML, adapter.getAttrList(node));
    return serializeOuter(element, { treeAdapter: adapter });
  }
}
