import { isHiddenElement, REPORTED_TAGS } from 'agent-input-sanitizer/html';
import { defaultTreeAdapter, html, parse, serializeOuter, type DefaultTreeAdapterTypes } from 'parse5';

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export class HiddenHtmlScanner {
  private static readonly treeAdapter = {
    ...defaultTreeAdapter,
    setDocumentMode(document: DefaultTreeAdapterTypes.Document, mode: html.DOCUMENT_MODE): void {
      const hasDoctype = document.childNodes.some(defaultTreeAdapter.isDocumentTypeNode);
      defaultTreeAdapter.setDocumentMode(document, hasDoctype ? mode : html.DOCUMENT_MODE.NO_QUIRKS);
    },
  };
  private readonly ranges: { start: number; end: number; kind: 'comment' | 'hidden' }[] = [];
  private readonly warned = { tags: {} as Record<string, number>, dataSrc: 0 };
  private readonly urlSources: string[] = [];

  private constructor(private readonly text: string) {}

  public static scan(text: string) {
    const scanner = new HiddenHtmlScanner(text);
    const document = parse(text, {
      treeAdapter: HiddenHtmlScanner.treeAdapter,
      sourceCodeLocationInfo: true,
      scriptingEnabled: false,
    });
    scanner.visit(document, false);
    return {
      ranges: scanner.ranges,
      warned: scanner.warned,
      urlSource: scanner.urlSources.join(''),
    };
  }

  private visit(node: HtmlNode, removedAncestor: boolean): void {
    if (defaultTreeAdapter.isElementNode(node) && node.attrs.length > 0) {
      this.urlSources.push(HiddenHtmlScanner.urlSource(node));
    }
    const removed = removedAncestor || this.recordNode(node);
    const children = 'content' in node
      ? node.content.childNodes
      : 'childNodes' in node ? node.childNodes : [];
    for (const child of children) this.visit(child, removed);
  }

  private recordNode(node: HtmlNode): boolean {
    if (defaultTreeAdapter.isCommentNode(node)) {
      this.recordRange(node, 'comment');
      return true;
    }
    if (!defaultTreeAdapter.isElementNode(node)) return false;
    const properties = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    if (isHiddenElement({ type: 'element', properties })) {
      this.recordRange(node, 'hidden');
      return true;
    }
    if (REPORTED_TAGS.has(node.tagName)) {
      this.warned.tags[node.tagName] = (this.warned.tags[node.tagName] ?? 0) + 1;
    }
    if (properties.src?.startsWith('data:')) this.warned.dataSrc++;
    return false;
  }

  private recordRange(node: HtmlNode, kind: 'comment' | 'hidden'): void {
    const location = node.sourceCodeLocation;
    const unclosedBody = defaultTreeAdapter.isElementNode(node)
      && node.tagName === 'body' && !node.sourceCodeLocation?.endTag;
    this.ranges.push({
      start: location?.startOffset ?? 0,
      end: unclosedBody ? this.text.length : location?.endOffset ?? this.text.length,
      kind,
    });
  }

  private static urlSource(node: HtmlElement): string {
    // The URL detector skips document elements and template contents.
    // Separate attribute sources keep these URLs visible to that detector.
    const tag = node.tagName === 'img' || node.tagName === 'meta' ? node.tagName : 'div';
    return serializeOuter(defaultTreeAdapter.createElement(tag, html.NS.HTML, node.attrs));
  }
}
