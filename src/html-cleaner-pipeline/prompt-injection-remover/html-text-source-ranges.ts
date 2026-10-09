import { defaultTreeAdapter, type DefaultTreeAdapterMap, type DefaultTreeAdapterTypes, type TreeAdapter } from 'parse5';

type SourceRange = { start: number; end: number };
type TextNode = DefaultTreeAdapterTypes.TextNode;

export class HtmlTextSourceRanges {
  private readonly ranges = new WeakMap<TextNode, SourceRange[]>();

  public readonly adapter: TreeAdapter<DefaultTreeAdapterMap> = {
    ...defaultTreeAdapter,
    insertText: (parent, text): void => {
      defaultTreeAdapter.insertText(parent, text);
      this.clearTextLocation(parent.childNodes.at(-1));
    },
    insertTextBefore: (parent, text, reference): void => {
      defaultTreeAdapter.insertTextBefore(parent, text, reference);
      this.clearTextLocation(parent.childNodes[parent.childNodes.indexOf(reference) - 1]);
    },
    setNodeSourceCodeLocation: (node, location): void => {
      defaultTreeAdapter.setNodeSourceCodeLocation(node, location);
      if (defaultTreeAdapter.isTextNode(node) && location !== null) {
        this.record(node, { start: location.startOffset, end: location.endOffset });
      }
    },
  };

  public get(node: TextNode): readonly SourceRange[] {
    const ranges = this.ranges.get(node);
    if (ranges === undefined) throw new Error('HTML text has no source ranges');
    return ranges;
  }

  private clearTextLocation(node: DefaultTreeAdapterTypes.ChildNode | undefined): void {
    if (node === undefined || !defaultTreeAdapter.isTextNode(node)) {
      throw new Error('HTML text insertion has no text node');
    }
    // Clear the previous location so the parser supplies each full token range.
    defaultTreeAdapter.setNodeSourceCodeLocation(node, null);
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
