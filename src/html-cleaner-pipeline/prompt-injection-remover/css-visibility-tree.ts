import { parse } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { documentElements, type HtmlElement } from './css-visibility-selectors.ts';

export type SourceElement = (element: HtmlElement) => HtmlElement;

export function parseSourceDocument(html: string) {
  const tokenSources = new WeakMap<Parameters<typeof adapter.createElement>[2], HtmlElement>();
  const sources = new Map<HtmlElement, HtmlElement>();
  const treeAdapter: typeof adapter = {
    ...adapter,
    createElement(...args: Parameters<typeof adapter.createElement>) {
      const element = adapter.createElement(...args);
      // parse5 reuses token attributes for copies that have no source location.
      const source = tokenSources.get(args[2]) ?? element;
      tokenSources.set(args[2], source);
      sources.set(element, source);
      return element;
    },
  };
  const document = parse(html, { treeAdapter, sourceCodeLocationInfo: true });
  const sourceElement: SourceElement = (element) => sources.get(element) ?? element;
  return { document, elements: documentElements(document), sourceElement };
}

export type CssHtmlDocument = ReturnType<typeof parseSourceDocument>;
