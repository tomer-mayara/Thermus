import { resolveElementVisibility, REPORTED_TAGS, type ElementVisibility } from 'agent-input-sanitizer/html';
import { defaultTreeAdapter, html, parse, serializeOuter, type DefaultTreeAdapterTypes } from 'parse5';
import { HtmlTextSourceRanges } from './html-text-source-ranges.ts';

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

export class HiddenHtmlScanner {
  private static readonly exfilTagsToPreserve = new Set(['img', 'meta']);
  private quirksMode = false;
  private rootSize: number | null = null;
  private readonly ranges: { start: number; end: number }[] = [];
  private readonly removed = { comments: 0, hidden: 0 };
  private readonly warned = { tags: {} as Record<string, number>, dataSrc: 0 };
  private readonly urlSources: string[] = [];
  private readonly textSources = new HtmlTextSourceRanges();

  private constructor() {}

  public static scan(text: string) {
    const scanner = new HiddenHtmlScanner();
    const document = parse(text, {
      treeAdapter: {
        ...scanner.textSources.adapter,
        setDocumentMode(document, mode): void {
          // Use the original mode for CSS. Keep the existing table boundaries.
          scanner.quirksMode = mode === html.DOCUMENT_MODE.QUIRKS;
          const hasDoctype = document.childNodes.some(defaultTreeAdapter.isDocumentTypeNode);
          defaultTreeAdapter.setDocumentMode(document, hasDoctype ? mode : html.DOCUMENT_MODE.NO_QUIRKS);
        },
      },
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

  private visit(node: HtmlNode, removedAncestor: boolean, parent?: ElementVisibility): void {
    if (defaultTreeAdapter.isElementNode(node) && node.attrs.length > 0) {
      this.urlSources.push(HiddenHtmlScanner.urlSource(node));
    }
    const visibility = !removedAncestor && defaultTreeAdapter.isElementNode(node)
      ? this.elementVisibility(node, parent) : parent;
    const removed = removedAncestor || this.recordNode(node, visibility);
    if (removed) this.recordSource(node);
    const children = 'content' in node
      ? node.content.childNodes
      : 'childNodes' in node ? node.childNodes : [];
    for (const child of children) this.visit(child, removed, visibility);
  }

  private elementVisibility(node: HtmlElement, parent?: ElementVisibility): ElementVisibility {
    const properties = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    const visibility = resolveElementVisibility({ type: 'element', properties }, parent, {
      rootSize: this.rootSize,
      quirksMode: this.quirksMode,
    });
    if (node.tagName === 'html') this.rootSize = visibility.fontSize;
    return visibility;
  }

  private recordNode(node: HtmlNode, visibility?: ElementVisibility): boolean {
    if (defaultTreeAdapter.isCommentNode(node)) {
      if (node.sourceCodeLocation == null) throw new Error('HTML comment has no source range');
      this.removed.comments++;
      return true;
    }
    if (defaultTreeAdapter.isTextNode(node) && node.value.trim() && visibility?.hiddenText) {
      if (node.sourceCodeLocation == null) throw new Error('Hidden HTML text has no source range');
      this.removed.hidden++;
      return true;
    }
    if (!defaultTreeAdapter.isElementNode(node)) return false;
    return this.recordElement(node, visibility);
  }

  private recordElement(node: HtmlElement, visibility?: ElementVisibility): boolean {
    if (visibility?.hiddenElement) {
      if (node.sourceCodeLocation == null) throw new Error('Hidden HTML element has no source range');
      this.removed.hidden++;
      return true;
    }
    if (HiddenHtmlScanner.hasHiddenContent(node, visibility)) {
      this.removed.hidden++;
      return true;
    }
    this.recordWarnings(node);
    return false;
  }

  private static hasHiddenContent(node: HtmlElement, visibility?: ElementVisibility): boolean {
    if (!visibility || !node.sourceCodeLocation) return false;
    if (visibility.hiddenPlane && !visibility.preserves3d) return true;
    return node.tagName === 'img' && (visibility.offscreen || visibility.hiddenPlane);
  }

  private recordWarnings(node: HtmlElement): void {
    const properties = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    if (REPORTED_TAGS.has(node.tagName)) {
      this.warned.tags[node.tagName] = (this.warned.tags[node.tagName] ?? 0) + 1;
    }
    if (properties.src?.startsWith('data:')) this.warned.dataSrc++;
  }

  private recordSource(node: HtmlNode): void {
    if (defaultTreeAdapter.isTextNode(node)) {
      for (const range of this.textSources.get(node)) this.ranges.push(range);
      return;
    }
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
