import { compile } from 'css-select';
import { generate, type CssNode } from 'css-tree';
import { DomUtils } from 'htmlparser2';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { selectorSpecificity } from './css-visibility-rules.ts';

export type HtmlElement = Htmlparser2TreeAdapterMap['element'];
export type HtmlDocument = Htmlparser2TreeAdapterMap['document'];
type HtmlNode = Htmlparser2TreeAdapterMap['node'];

const maxSelectorNodes = 128;
const maxSelectorLength = 4096;
const maxSelectorWork = 1_000_000;

export function documentElements(document: HtmlDocument): HtmlElement[] {
  const elements: HtmlElement[] = [];
  const pending: HtmlNode[] = [document];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (adapter.isElementNode(node)) {
      elements.push(node);
      if (node.name === 'template') continue;
    }
    if (!('children' in node)) continue;
    for (let index = node.children.length - 1; index >= 0; index--) {
      pending.push(node.children[index]);
    }
  }
  return elements;
}

function boundedAdapter() {
  let remaining = maxSelectorWork;
  const spend = (cost = 1) => {
    remaining -= cost;
    if (remaining < 0) throw new RangeError('CSS selector work limit exceeded');
  };
  return {
    ...DomUtils,
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
    prevElementSibling(node: HtmlNode) {
      for (let previous = node.prev; previous !== null; previous = previous.prev) {
        spend();
        if (adapter.isElementNode(previous)) return previous;
      }
      return null;
    },
  };
}

export function createSelectorMatcher(document: HtmlDocument) {
  const options = {
    adapter: boundedAdapter(),
    quirksMode: document['x-mode'] === 'quirks',
  };
  return (prelude: CssNode) => {
    if (prelude.type !== 'SelectorList') return undefined;
    const selectors = [];
    for (const selector of prelude.children) {
      if (selector.type !== 'Selector') return undefined;
      if (selector.children.size > maxSelectorNodes) {
        throw new RangeError('CSS selector size limit exceeded');
      }
      const specificity = selectorSpecificity(selector);
      if (specificity === undefined) return undefined;
      const css = generate(selector);
      if (css.length > maxSelectorLength) throw new RangeError('CSS selector size limit exceeded');
      try {
        selectors.push({ specificity, query: compile<HtmlNode, HtmlElement>(css, options) });
      } catch (error) {
        if (error instanceof RangeError) throw error;
        return undefined;
      }
    }
    return selectors;
  };
}
