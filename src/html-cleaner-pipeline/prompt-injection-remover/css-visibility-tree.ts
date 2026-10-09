import { html as htmlNames, parse } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { documentElements, type HtmlElement } from './css-visibility-selectors.ts';

export type SourceElement = (element: HtmlElement) => HtmlElement;

export function parseSourceDocument(html: string) {
  const tokenSources = new WeakMap<Parameters<typeof adapter.createElement>[2], HtmlElement>();
  const sources = new Map<HtmlElement, HtmlElement>();
  let authoredMode = htmlNames.DOCUMENT_MODE.NO_QUIRKS;
  const treeAdapter: typeof adapter = {
    ...adapter,
    setDocumentMode(document, mode) {
      authoredMode = mode;
      const hasDoctype = document.children.some(adapter.isDocumentTypeNode);
      adapter.setDocumentMode(document, hasDoctype ? mode : htmlNames.DOCUMENT_MODE.NO_QUIRKS);
    },
    createElement(...args: Parameters<typeof adapter.createElement>) {
      const element = adapter.createElement(...args);
      // parse5 reuses token attributes for copies that have no source location.
      const source = tokenSources.get(args[2]) ?? element;
      tokenSources.set(args[2], source);
      sources.set(element, source);
      return element;
    },
  };
  const document = parse(html, { treeAdapter, sourceCodeLocationInfo: true, scriptingEnabled: false });
  // Keep the authored mode for selector matching after source-tree recovery.
  adapter.setDocumentMode(document, authoredMode);
  const sourceElement: SourceElement = (element) => sources.get(element) ?? element;
  return { document, elements: documentElements(document), sourceElement };
}

export type CssHtmlDocument = ReturnType<typeof parseSourceDocument>;
