import { adapter } from 'parse5-htmlparser2-tree-adapter';
import type { HtmlElement } from './css-visibility-selectors.ts';
import type { CssHtmlDocument } from './css-visibility-tree.ts';
import type { VisibilityStyle } from './css-visibility.ts';

type Range = { start: number; end: number };
type Source = Range & { identity: number };
type ImpliedNode = { node: HtmlElement; path: string };
type ElementContext = {
  node: HtmlElement;
  identity: number;
  range?: Source;
  parent?: Source;
  implied: ImpliedNode[];
};

function rangeKey(range: Source | undefined): string {
  return range ? `${range.start}:${range.end}:${range.identity}` : 'document';
}

function witnessKey(parent: Source | undefined, path: string, child: Source): string {
  return `${rangeKey(parent)}/${path}/${rangeKey(child)}`;
}

function documentKey({ node, range, identity }: ElementContext): number | undefined {
  if (range || !['html', 'head', 'body'].includes(node.name)) return undefined;
  return identity;
}

function childContext(
  node: HtmlElement, ancestor: ElementContext | undefined, source: { identity: number; range?: Source },
): ElementContext {
  const parent = ancestor?.range ?? ancestor?.parent;
  const inherited = ancestor && !ancestor.range ? ancestor.implied : [];
  const path = `${inherited.at(-1)?.path ?? ''}/${source.identity}`;
  const implied = source.range ? inherited : [...inherited, { node, path }];
  return { node, ...source, parent, implied };
}

function elementContexts(tree: CssHtmlDocument, identify: (node: HtmlElement) => number): ElementContext[] {
  const contexts = new Map<HtmlElement, ElementContext>();
  const identities = new Map<HtmlElement, number>();
  for (const node of tree.elements) {
    const ancestor = node.parent && adapter.isElementNode(node.parent)
      ? contexts.get(node.parent) : undefined;
    const source = tree.sourceElement(node);
    let identity = identities.get(source);
    if (identity === undefined) {
      identity = identify(source);
      identities.set(source, identity);
    }
    const location = adapter.getNodeSourceCodeLocation(source)?.startTag;
    const range = location ? { start: location.startOffset, end: location.endOffset, identity } : undefined;
    contexts.set(node, childContext(node, ancestor, { identity, range }));
  }
  return [...contexts.values()];
}

function rangeRemapper(ranges: Range[]) {
  const removed: (Range & { total: number })[] = [];
  for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
    const previous = removed.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else removed.push({ ...range, total: 0 });
  }
  let total = 0;
  for (const range of removed) {
    total += range.end - range.start;
    range.total = total;
  }
  return <T extends Range>(range: T): T | undefined => {
    let lower = 0;
    let upper = removed.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (removed[middle].end <= range.start) lower = middle + 1;
      else upper = middle;
    }
    if (removed[lower] && removed[lower].start < range.end) return undefined;
    const deleted = lower === 0 ? 0 : removed[lower - 1].total;
    return { ...range, start: range.start - deleted, end: range.end - deleted };
  };
}

export class CssVisibilityProvenance {
  private tags = new Set<string>();
  private witnesses = new Set<string>();
  private documents = new Set<number>();
  private readonly identities = new Map<string, number>();

  public apply(tree: CssHtmlDocument, styles: Map<HtmlElement, VisibilityStyle>): ElementContext[] {
    const contexts = elementContexts(tree, (node) => this.identify(node));
    for (const context of contexts) {
      const document = documentKey(context);
      if (document !== undefined && this.documents.has(document)) styles.set(context.node, '');
      if (!context.range) continue;
      if (this.tags.has(rangeKey(context.range))) styles.set(context.node, '');
      for (const implied of context.implied) {
        if (this.witnesses.has(witnessKey(context.parent, implied.path, context.range))) {
          styles.set(implied.node, '');
        }
      }
    }
    return contexts;
  }

  public retain(contexts: ElementContext[], visible: Set<HtmlElement>, ranges: Range[]): void {
    const remap = rangeRemapper(ranges);
    this.tags = new Set();
    this.witnesses = new Set();
    this.documents = new Set();
    for (const context of contexts) {
      if (!visible.has(context.node)) continue;
      const document = documentKey(context);
      if (document !== undefined) this.documents.add(document);
      this.retainElement(context, remap);
    }
  }

  private identify(node: HtmlElement): number {
    const key = JSON.stringify([node.name, Object.entries(node.attribs).sort()]);
    let identity = this.identities.get(key);
    if (identity === undefined) {
      identity = this.identities.size;
      this.identities.set(key, identity);
    }
    return identity;
  }

  private retainElement(context: ElementContext, remap: ReturnType<typeof rangeRemapper>): void {
    if (!context.range) return;
    const range = remap(context.range);
    if (!range) return;
    // Hidden-copy content is gone before shared source tags are retained.
    this.tags.add(rangeKey(range));
    const parent = context.parent ? remap(context.parent) : undefined;
    if (context.parent && !parent) return;
    for (const implied of context.implied) {
      this.witnesses.add(witnessKey(parent, implied.path, range));
    }
  }
}
