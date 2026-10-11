import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import type { SourceHtmlDocument } from './css-visibility-tree.ts';

type HtmlNode = Htmlparser2TreeAdapterMap['node'];
type RemovalKind = 'comments' | 'hidden';

export class HiddenHtmlRemovalCounts {
  private readonly kinds = new Map<HtmlNode, RemovalKind>();
  private readonly roots = new Map<HtmlNode, HtmlNode>();
  private readonly deleted = new Set<HtmlNode>();

  public constructor(private readonly tree: SourceHtmlDocument) {}

  public add(node: HtmlNode, kind: RemovalKind): void {
    this.kinds.set(node, kind);
  }

  public cover(node: HtmlNode, root: HtmlNode): void {
    this.roots.set(node, root);
  }

  public recordDeletion(node: HtmlNode): void {
    const root = this.roots.get(node);
    if (root) this.deleted.add(root);
  }

  public counts(): Record<RemovalKind, number> {
    const counts = { comments: 0, hidden: 0 };
    const sources = new Set<HtmlNode>();
    for (const root of this.deleted) {
      const source = adapter.isElementNode(root) ? this.tree.sourceElement(root) : root;
      if (sources.has(source)) continue;
      sources.add(source);
      const kind = this.kinds.get(root);
      if (kind) counts[kind]++;
    }
    return counts;
  }
}
