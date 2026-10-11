import { adapter as baseAdapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';

type SourceRange = { start: number; end: number };
type TextNode = Htmlparser2TreeAdapterMap['textNode'];

export class HtmlTextSourceRanges {
  private readonly ranges = new WeakMap<TextNode, SourceRange[]>();

  public readonly adapter: typeof baseAdapter = {
    ...baseAdapter,
    insertText: (parent, text): void => {
      baseAdapter.insertText(parent, text);
      this.clearTextLocation(parent.children.at(-1));
    },
    insertTextBefore: (parent, text, reference): void => {
      baseAdapter.insertTextBefore(parent, text, reference);
      this.clearTextLocation(parent.children[parent.children.indexOf(reference) - 1]);
    },
    setNodeSourceCodeLocation: (node, location): void => {
      baseAdapter.setNodeSourceCodeLocation(node, location);
      if (baseAdapter.isTextNode(node) && location !== null) {
        this.record(node, { start: location.startOffset, end: location.endOffset });
      }
    },
  };

  public get(node: TextNode): readonly SourceRange[] {
    const ranges = this.ranges.get(node);
    if (ranges === undefined) throw new Error('HTML text has no source ranges');
    return ranges;
  }

  private clearTextLocation(node: Htmlparser2TreeAdapterMap['childNode'] | undefined): void {
    if (node === undefined || !baseAdapter.isTextNode(node)) {
      throw new Error('HTML text insertion has no text node');
    }
    // Clear the previous location so the parser supplies each full token range.
    baseAdapter.setNodeSourceCodeLocation(node, null);
  }

  private record(node: TextNode, range: SourceRange): void {
    const ranges = this.ranges.get(node) ?? [];
    const previous = ranges.at(-1);
    if (previous?.end === range.start) {
      previous.end = range.end;
    } else {
      ranges.push(range);
    }
    this.ranges.set(node, ranges);
  }
}
