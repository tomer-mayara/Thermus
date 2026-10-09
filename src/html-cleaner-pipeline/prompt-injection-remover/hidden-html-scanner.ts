import { isHiddenElement, REPORTED_TAGS } from 'agent-input-sanitizer/html';
import { defaultTreeAdapter, html, parse, serializeOuter, type DefaultTreeAdapterTypes } from 'parse5';

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export class HiddenHtmlScanner {
  private static readonly exfilTagsToPreserve = new Set(['img', 'meta']);
  private static readonly treeAdapter = {
    ...defaultTreeAdapter,
    setDocumentMode(document: DefaultTreeAdapterTypes.Document, mode: html.DOCUMENT_MODE): void {
      const hasDoctype = document.childNodes.some(defaultTreeAdapter.isDocumentTypeNode);
      defaultTreeAdapter.setDocumentMode(document, hasDoctype ? mode : html.DOCUMENT_MODE.NO_QUIRKS);
    },
  };
  private readonly ranges: { start: number; end: number }[] = [];
  private readonly removed = { comments: 0, hidden: 0 };
  private readonly warned = { tags: {} as Record<string, number>, dataSrc: 0 };
  private readonly urlSources: string[] = [];

  private constructor() {}

  public static scan(text: string) {
    const scanner = new HiddenHtmlScanner();
    const document = parse(text, {
      treeAdapter: HiddenHtmlScanner.treeAdapter,
      sourceCodeLocationInfo: true,
      scriptingEnabled: false,
    });
    scanner.visit(document, false);
    return {
      ranges: scanner.ranges,
      removed: scanner.removed,
      warned: scanner.warned,
      urlSource: scanner.urlSources.join(''),
    };
  }

  private visit(node: HtmlNode, removedAncestor: boolean): void {
    if (defaultTreeAdapter.isElementNode(node) && node.attrs.length > 0) {
      this.urlSources.push(HiddenHtmlScanner.urlSource(node));
    }
    const removed = removedAncestor || this.recordNode(node);
    if (removed) this.recordSource(node);
    const children = 'content' in node
      ? node.content.childNodes
      : 'childNodes' in node ? node.childNodes : [];
    for (const child of children) this.visit(child, removed);
  }

  private recordNode(node: HtmlNode): boolean {
    if (defaultTreeAdapter.isCommentNode(node)) {
      if (node.sourceCodeLocation == null) throw new Error('HTML comment has no source range');
      this.removed.comments++;
      return true;
    }
    if (!defaultTreeAdapter.isElementNode(node)) return false;
    const properties = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    if (isHiddenElement({ type: 'element', properties })) {
      if (node.sourceCodeLocation == null) throw new Error('Hidden HTML element has no source range');
      this.removed.hidden++;
      return true;
    }
    if (REPORTED_TAGS.has(node.tagName)) {
      this.warned.tags[node.tagName] = (this.warned.tags[node.tagName] ?? 0) + 1;
    }
    if (properties.src?.startsWith('data:')) this.warned.dataSrc++;
    return false;
  }

  private recordSource(node: HtmlNode): void {
    const location = node.sourceCodeLocation;
    if (location == null) return;
    // Element intervals can include visible nodes or exclude hidden descendants.
    // Record each tag and text range under the parsed hidden ancestor instead.
    const sources = defaultTreeAdapter.isElementNode(node)
      ? [node.sourceCodeLocation?.startTag, node.sourceCodeLocation?.endTag]
      : [location];
    for (const source of sources) {
      if (source) this.ranges.push({ start: source.startOffset, end: source.endOffset });
    }
  }

  private static urlSource(node: HtmlElement): string {
    // The URL detector skips document elements and template contents.
    // Separate attribute sources keep these URLs visible to that detector.
    const tag = HiddenHtmlScanner.exfilTagsToPreserve.has(node.tagName) ? node.tagName : 'div';
    return serializeOuter(defaultTreeAdapter.createElement(tag, html.NS.HTML, node.attrs));
  }
}
