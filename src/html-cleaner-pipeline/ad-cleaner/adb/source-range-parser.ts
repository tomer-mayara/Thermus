import { Parser, Token } from 'parse5';
import { type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';

type HtmlElement = Htmlparser2TreeAdapterMap['element'];
type HtmlNode = Htmlparser2TreeAdapterMap['node'];

type EndTagIndex = {
  start: number;
  end: number;
  location?: Token.Location;
  left?: EndTagIndex;
  right?: EndTagIndex;
};

export class SourceRangeParser extends Parser<Htmlparser2TreeAdapterMap> {
  private readonly endTags = new WeakMap<HtmlNode, Token.Location[]>();
  private readonly endTagIndexes = new WeakMap<HtmlNode, EndTagIndex>();
  private lastEndTagOffset = 0;

  public override _setEndLocation(element: HtmlElement, closingToken: Token.Token): void {
    const explicitEndTag = element.sourceCodeLocation?.endTag;
    super._setEndLocation(element, closingToken);
    if (explicitEndTag !== undefined) {
      this.treeAdapter.updateNodeSourceCodeLocation(element, {
        endTag: explicitEndTag,
        endLine: explicitEndTag.endLine,
        endCol: explicitEndTag.endCol,
        endOffset: explicitEndTag.endOffset,
      });
    }
    const closingLocation = closingToken.location;
    if (closingToken.type === Token.TokenType.END_TAG
      && closingToken.tagName === element.name && closingLocation !== null) {
      const endTags = this.endTags.get(element) ?? [];
      endTags.push(closingLocation);
      this.endTags.set(element, endTags);
      this.lastEndTagOffset = Math.max(this.lastEndTagOffset, closingLocation.startOffset);
    }
    if (closingToken.type === Token.TokenType.EOF) {
      this.excludeAncestorEndTags(element);
    }
  }

  private excludeAncestorEndTags(element: HtmlElement): void {
    const location = element.sourceCodeLocation;
    const parent = element.parent;
    if (location == null || parent === null) {
      return;
    }
    const index = this.getEndTagIndex(parent);
    const boundary = SourceRangeParser.findEndTag(index, location.startOffset);
    if (boundary !== undefined && boundary.startOffset < location.endOffset) {
      this.treeAdapter.updateNodeSourceCodeLocation(element, {
        endLine: boundary.startLine,
        endCol: boundary.startCol,
        endOffset: boundary.startOffset,
      });
    }
  }

  private getEndTagIndex(element: HtmlNode): EndTagIndex {
    const uncached: HtmlNode[] = [];
    let node: HtmlNode | null = element;
    // EOF has no more close events. Each ancestor can now share a fixed index.
    while (node !== null && !this.endTagIndexes.has(node)) {
      uncached.push(node);
      node = node.parent;
    }
    let index = (node === null ? undefined : this.endTagIndexes.get(node))
      ?? { start: 0, end: this.lastEndTagOffset };
    for (const ancestor of uncached.reverse()) {
      for (const endTag of this.endTags.get(ancestor) ?? []) {
        index = SourceRangeParser.insertEndTag(index, endTag);
      }
      this.endTagIndexes.set(ancestor, index);
    }
    return index;
  }

  private static insertEndTag(index: EndTagIndex, location: Token.Location): EndTagIndex {
    if (index.start === index.end) {
      return { ...index, location };
    }
    const middle = Math.floor((index.start + index.end) / 2);
    // A shared parent index must not receive a child's close events.
    if (location.startOffset <= middle) {
      const left = index.left ?? { start: index.start, end: middle };
      return { ...index, left: SourceRangeParser.insertEndTag(left, location) };
    }
    const right = index.right ?? { start: middle + 1, end: index.end };
    return { ...index, right: SourceRangeParser.insertEndTag(right, location) };
  }

  private static findEndTag(index: EndTagIndex | undefined, startOffset: number): Token.Location | undefined {
    if (index === undefined || index.end < startOffset) {
      return undefined;
    }
    return index.location
      ?? SourceRangeParser.findEndTag(index.left, startOffset)
      ?? SourceRangeParser.findEndTag(index.right, startOffset);
  }
}
