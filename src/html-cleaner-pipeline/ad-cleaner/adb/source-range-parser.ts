import { Parser, Token } from 'parse5';
import { type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';

type HtmlElement = Htmlparser2TreeAdapterMap['element'];
type HtmlNode = Htmlparser2TreeAdapterMap['node'];

export class SourceRangeParser extends Parser<Htmlparser2TreeAdapterMap> {
  private readonly endTags = new WeakMap<HtmlNode, Token.Location>();

  public override _setEndLocation(element: HtmlElement, closingToken: Token.Token): void {
    super._setEndLocation(element, closingToken);
    const closingLocation = closingToken.location;
    if (closingToken.type === Token.TokenType.END_TAG
      && closingToken.tagName === element.name && closingLocation !== null) {
      this.endTags.set(element, closingLocation);
    }
    if (closingToken.type === Token.TokenType.EOF) {
      this.excludeAncestorEndTags(element);
    }
  }

  private excludeAncestorEndTags(element: HtmlElement): void {
    const location = element.sourceCodeLocation;
    if (location == null) {
      return;
    }
    let boundary: Token.Location | undefined;
    for (let parent = element.parent; parent !== null; parent = parent.parent) {
      const endTag = this.endTags.get(parent);
      if (endTag !== undefined && endTag.startOffset >= location.startOffset
        && endTag.startOffset < (boundary?.startOffset ?? location.endOffset)) {
        boundary = endTag;
      }
    }
    if (boundary !== undefined) {
      this.treeAdapter.updateNodeSourceCodeLocation(element, {
        endLine: boundary.startLine,
        endCol: boundary.startCol,
        endOffset: boundary.startOffset,
      });
    }
  }
}
