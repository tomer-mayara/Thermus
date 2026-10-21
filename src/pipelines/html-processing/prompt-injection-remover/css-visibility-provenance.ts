import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { rangeRemapper, type Range } from './css-visibility-ranges.ts';
import type { HtmlElement } from './css-visibility-selectors.ts';
import type { SourceHtmlDocument } from './css-visibility-tree.ts';
import type { VisibilityStyle } from './css-visibility.ts';

type Source = Range & { identity: number };
type ImpliedNode = { node: HtmlElement; path: string };
type ElementSource = { identity: number; range?: Source; authored: boolean };
type ElementContext = {
  node: HtmlElement;
  identity: number;
  authored: boolean;
  range?: Source;
  parent?: Source;
  copyParent?: Source;
  implied: ImpliedNode[];
};
type StyledElementContext = Omit<ElementContext, 'implied'> & {
  style: VisibilityStyle;
  implied: (ImpliedNode & { style: VisibilityStyle })[];
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

function impliedContexts(
  node: HtmlElement, ancestor: ElementContext | undefined, source: ElementSource,
): ImpliedNode[] {
  const inherited = ancestor && !ancestor.range ? ancestor.implied : [];
  if (source.range) return inherited;
  const path = `${inherited.at(-1)?.path ?? ''}/${source.identity}`;
  return [...inherited, { node, path }];
}

function childContext(
  node: HtmlElement, ancestor: ElementContext | undefined, source: ElementSource,
): ElementContext {
  const parent = ancestor?.range ?? ancestor?.parent;
  const copyParent = ancestor?.authored && ancestor.range ? ancestor.range : ancestor?.copyParent;
  return { node, ...source, parent, copyParent, implied: impliedContexts(node, ancestor, source) };
}

function elementContexts(tree: SourceHtmlDocument, identify: (node: HtmlElement) => number): ElementContext[] {
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
    contexts.set(node, childContext(node, ancestor, { identity, range, authored: source === node }));
  }
  return [...contexts.values()];
}

function captureStyles(
  contexts: ElementContext[], styles: Map<HtmlElement, VisibilityStyle>,
): StyledElementContext[] {
  return contexts.map((context) => ({
    ...context,
    style: styles.get(context.node) ?? '',
    implied: context.implied.map((implied) => ({
      ...implied,
      style: styles.get(implied.node) ?? '',
    })),
  }));
}

export class CssVisibilityProvenance {
  private tags = new Map<string, VisibilityStyle | null>();
  private copies = new Map<string, VisibilityStyle | null>();
  private witnesses = new Map<string, VisibilityStyle>();
  private documents = new Map<number, VisibilityStyle>();
  private readonly identities = new Map<string, number>();

  public apply(tree: SourceHtmlDocument, styles: Map<HtmlElement, VisibilityStyle>): StyledElementContext[] {
    const contexts = elementContexts(tree, (node) => this.identify(node));
    for (const context of contexts) {
      const document = documentKey(context);
      const documentStyle = document === undefined ? undefined : this.documents.get(document);
      if (documentStyle !== undefined) styles.set(context.node, documentStyle);
      if (!context.range) continue;
      // The nearest authored parent distinguishes reconstructed copies of one tag.
      const retained = this.copies.get(witnessKey(context.copyParent, '', context.range))
        ?? this.tags.get(rangeKey(context.range));
      if (retained !== undefined && retained !== null) styles.set(context.node, retained);
      for (const implied of context.implied) {
        const style = this.witnesses.get(witnessKey(context.parent, implied.path, context.range));
        if (style !== undefined) styles.set(implied.node, style);
      }
    }
    return captureStyles(contexts, styles);
  }

  public retain(
    contexts: StyledElementContext[], visible: Set<HtmlElement>, ranges: Range[],
  ): void {
    const remap = rangeRemapper(ranges);
    this.tags = new Map();
    this.copies = new Map();
    this.witnesses = new Map();
    this.documents = new Map();
    for (const context of contexts) {
      if (!visible.has(context.node)) continue;
      const document = documentKey(context);
      if (document !== undefined) this.documents.set(document, context.style);
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

  private retainElement(
    context: StyledElementContext, remap: ReturnType<typeof rangeRemapper>,
  ): void {
    if (!context.range) return;
    const range = remap(context.range);
    if (!range) return;
    this.retainSharedStyle(range, context.style);
    this.retainCopyStyle(context, range, remap);
    this.retainImpliedStyles(context, range, remap);
  }

  private retainSharedStyle(range: Source, style: VisibilityStyle): void {
    const key = rangeKey(range);
    const previous = this.tags.get(key);
    // A shared source fallback is safe only when the surviving copies agree.
    this.tags.set(key, previous === undefined || previous === style ? style : null);
  }

  private retainCopyStyle(
    context: StyledElementContext, range: Source, remap: ReturnType<typeof rangeRemapper>,
  ): void {
    const copyParent = context.copyParent ? remap(context.copyParent) : undefined;
    if (context.copyParent && !copyParent) return;
    const key = witnessKey(copyParent, '', range);
    const previous = this.copies.get(key);
    this.copies.set(key, previous === undefined || previous === context.style ? context.style : null);
  }

  private retainImpliedStyles(
    context: StyledElementContext, range: Source, remap: ReturnType<typeof rangeRemapper>,
  ): void {
    const parent = context.parent ? remap(context.parent) : undefined;
    if (context.parent && !parent) return;
    for (const implied of context.implied) {
      this.witnesses.set(witnessKey(parent, implied.path, range), implied.style);
    }
  }
}
