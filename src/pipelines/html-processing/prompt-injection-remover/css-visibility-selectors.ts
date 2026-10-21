import { compile } from 'css-select';
import { generate, type CssNode, type Selector } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { selectorSpecificity } from './css-visibility-rules.ts';
import { simpleSelectorPredicate } from './css-selector-predicates.ts';
import { CssSelectorIndex } from './css-selector-index.ts';

export type HtmlElement = Htmlparser2TreeAdapterMap['element'];
export type HtmlDocument = Htmlparser2TreeAdapterMap['document'];
type HtmlNode = Htmlparser2TreeAdapterMap['node'];

const maxSelectorNodes = 128;
const maxSelectorLength = 4096;
const maxSelectorWork = 1_000_000;

export class CssSelectorLimitError extends RangeError {
  public constructor(limit: 'work' | 'size') {
    super(`CSS selector ${limit} limit exceeded`);
  }
}

export function documentElements(document: HtmlDocument, includeTemplateContent = false): HtmlElement[] {
  const elements: HtmlElement[] = [];
  const pending: HtmlNode[] = [document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (adapter.isElementNode(node)) {
      elements.push(node);
      if (node.name === 'template') {
        if (includeTemplateContent) {
          pending.push(adapter.getTemplateContent(node));
        }
        continue;
      }
    }
    if (!('children' in node)) continue;
    for (let index = node.children.length - 1; index >= 0; index--) {
      pending.push(node.children[index]);
    }
  }
  return elements;
}

function boundedAdapter(quirksMode: boolean, document: HtmlDocument) {
  let remaining = maxSelectorWork;
  const spend = (cost = 1) => {
    remaining -= cost;
    if (remaining < 0) throw new CssSelectorLimitError('work');
  };
  const index = new CssSelectorIndex(() => documentElements(document), quirksMode, spend);
  return {
    ...DomUtils,
    index,
    isTag(node: HtmlNode): node is HtmlElement {
      spend();
      return adapter.isElementNode(node);
    },
    getParent(node: HtmlNode) {
      spend();
      return node.parent;
    },
    getAttributeValue(element: HtmlElement, name: string) {
      const value = DomUtils.getAttributeValue(element, name);
      spend(1 + (value?.length ?? 0));
      return value;
    },
    hasClass(element: HtmlElement, name: string) {
      return index.hasClass(element, name);
    },
    getName(element: HtmlElement) {
      spend(1 + element.name.length);
      return element.name;
    },
    prevElementSibling(node: HtmlNode) {
      for (let previous = node.prev; previous !== null; previous = previous.prev) {
        spend();
        if (adapter.isElementNode(previous)) return previous;
      }
      return null;
    },
  };
}

function compileSelector(selector: Selector, options: {
  adapter: ReturnType<typeof boundedAdapter>;
  quirksMode: boolean;
}) {
  const parts: string[] = [];
  const pseudos: Record<string, (element: HtmlElement) => boolean> = {};
  const context = { ...options.adapter, quirksMode: options.quirksMode };
  // css-select treats an escaped star as a wildcard and folds some non-ASCII characters.
  for (const node of selector.children) {
    if (node.type === 'Combinator') {
      parts.push(node.name);
      continue;
    }
    const name = `visibility-${parts.length}`;
    pseudos[name] = simpleSelectorPredicate(node, context);
    parts.push(`:${name}`);
  }
  return compile<HtmlNode, HtmlElement>(parts.join(''), { ...options, pseudos });
}

export function createSelectorMatcher(document: HtmlDocument) {
  const quirksMode = document['x-mode'] === 'quirks';
  const options = {
    adapter: boundedAdapter(quirksMode, document),
    quirksMode,
  };
  return (prelude: CssNode) => {
    if (prelude.type !== 'SelectorList') return undefined;
    const selectors = [];
    for (const selector of prelude.children) {
      if (selector.type !== 'Selector') return undefined;
      if (selector.children.size > maxSelectorNodes) {
        throw new CssSelectorLimitError('size');
      }
      const specificity = selectorSpecificity(selector);
      if (specificity === undefined) return undefined;
      const css = generate(selector);
      if (css.length > maxSelectorLength) throw new CssSelectorLimitError('size');
      try {
        selectors.push({ specificity, query: compileSelector(selector, options), candidates: () => options.adapter.index.candidates(selector) });
      } catch (error) {
        if (error instanceof RangeError) throw error;
        return undefined;
      }
    }
    return selectors;
  };
}
