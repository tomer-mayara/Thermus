import { ident, type CssNode, type Selector } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import type { HtmlElement } from './css-visibility-selectors.ts';

type IndexKind = 'class' | 'id' | 'type';
type HtmlNode = Htmlparser2TreeAdapterMap['node'];
type CandidateSelection = { readonly elements: readonly HtmlElement[]; readonly distance: number };

export class CssSelectorIndex {
  private documentElements: readonly HtmlElement[] | undefined;
  private readonly classes = new WeakMap<HtmlElement, Set<string>>();
  private readonly indexes = new Map<IndexKind, Map<string, HtmlElement[]>>();
  private readonly scopes = new WeakMap<readonly HtmlElement[], readonly HtmlElement[]>();
  private readonly scopeMembers = new WeakMap<readonly HtmlElement[], ReadonlySet<HtmlElement>>();

  public constructor(
    private readonly readElements: () => readonly HtmlElement[],
    private readonly quirksMode: boolean,
    private readonly spend: (cost?: number) => void,
  ) {}

  private elements(): readonly HtmlElement[] {
    if (this.documentElements === undefined) {
      this.documentElements = this.readElements();
      this.spend(this.documentElements.length);
    }
    return this.documentElements;
  }

  private normalize(value: string): string {
    const lowerCharacter = (character: string) => character.toLowerCase();
    return value.replace(/[A-Z]/g, lowerCharacter);
  }

  private classTokens(element: HtmlElement): Set<string> {
    let tokens = this.classes.get(element);
    if (tokens === undefined) {
      const value = DomUtils.getAttributeValue(element, 'class') ?? '';
      this.spend(value.length);
      const normalized = this.quirksMode ? this.normalize(value) : value;
      tokens = new Set(normalized.split(/[\t\n\f\r ]/).filter(Boolean));
      this.classes.set(element, tokens);
    }
    return tokens;
  }

  public hasClass(element: HtmlElement, name: string): boolean {
    this.spend();
    return this.classTokens(element).has(name);
  }

  private keys(element: HtmlElement, kind: IndexKind): Iterable<string> {
    if (kind === 'class') return this.classTokens(element);
    const value = kind === 'type' ? element.name : DomUtils.getAttributeValue(element, 'id') ?? '';
    this.spend(value.length);
    return [kind === 'type' || this.quirksMode ? this.normalize(value) : value];
  }

  private index(kind: IndexKind): Map<string, HtmlElement[]> {
    let index = this.indexes.get(kind);
    if (index !== undefined) return index;
    index = new Map();
    for (const element of this.elements()) {
      this.spend();
      for (const key of this.keys(element, kind)) {
        this.spend();
        const matches = index.get(key) ?? [];
        matches.push(element);
        index.set(key, matches);
      }
    }
    this.indexes.set(kind, index);
    return index;
  }

  private lookup(node: CssNode): readonly HtmlElement[] | undefined {
    let kind: IndexKind;
    switch (node.type) {
      case 'ClassSelector': kind = 'class'; break;
      case 'IdSelector': kind = 'id'; break;
      case 'TypeSelector':
        if (node.name === '*') return undefined;
        kind = 'type'; break;
      default: return undefined;
    }
    this.spend(node.name.length);
    const decoded = ident.decode(node.name);
    const key = kind === 'type' || this.quirksMode ? this.normalize(decoded) : decoded;
    return this.index(kind).get(key) ?? [];
  }

  private descendants(roots: readonly HtmlElement[]): readonly HtmlElement[] {
    const cached = this.scopes.get(roots);
    if (cached !== undefined) return cached;
    const pending: HtmlNode[] = [];
    const addChildren = (node: HtmlNode) => {
      if (adapter.isElementNode(node) && node.name === 'template') return;
      if (!('children' in node)) return;
      for (const child of node.children) {
        this.spend();
        pending.push(child);
      }
    };
    for (const root of roots) addChildren(root);
    const visited = new Set<HtmlNode>();
    const elements: HtmlElement[] = [];
    for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
      this.spend();
      if (visited.has(node)) continue;
      visited.add(node);
      if (adapter.isElementNode(node)) {
        elements.push(node);
      }
      addChildren(node);
    }
    this.scopes.set(roots, elements);
    return elements;
  }

  private restrict(candidates: readonly HtmlElement[], roots: readonly HtmlElement[]): readonly HtmlElement[] {
    const scope = this.descendants(roots);
    let members = this.scopeMembers.get(scope);
    if (members === undefined) {
      this.spend(scope.length);
      members = new Set(scope);
      this.scopeMembers.set(scope, members);
    }
    const isInScope = (element: HtmlElement) => { this.spend(); return members.has(element); };
    return candidates.filter(isInScope);
  }

  private refineSelection(selection: CandidateSelection | undefined, matches: readonly HtmlElement[], distance: number): CandidateSelection {
    if (selection === undefined) return { elements: matches, distance };
    if (matches.length >= selection.elements.length) return selection;
    if (distance === selection.distance) return { elements: matches, distance };
    const candidates = selection.distance === 0 ? selection.elements : this.descendants(selection.elements);
    return { elements: this.restrict(candidates, matches), distance: 0 };
  }

  public candidates(selector: Selector): readonly HtmlElement[] {
    let selection: CandidateSelection | undefined;
    let distance = 0;
    let safeSuffix = true;
    const nodes = selector.children.toArray();
    for (let position = nodes.length - 1; position >= 0; position--) {
      this.spend();
      const node = nodes[position];
      if (node.type === 'Combinator') {
        distance++;
        safeSuffix = safeSuffix && (node.name === ' ' || node.name === '>');
        continue;
      }
      const matches = this.lookup(node);
      if (matches === undefined) continue;
      if (matches.length === 0) return [];
      if (!safeSuffix) continue;
      selection = this.refineSelection(selection, matches, distance);
    }
    if (selection === undefined) return this.elements();
    return selection.distance === 0 ? selection.elements : this.descendants(selection.elements);
  }
}
