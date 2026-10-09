import { html as htmlNames, Parser, type Token } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { documentElements, type HtmlElement } from './css-visibility-selectors.ts';

type SourceElement = (element: HtmlElement) => HtmlElement;

export function parseSourceDocument(html: string) {
  const tokenSources = new WeakMap<Parameters<typeof adapter.createElement>[2], HtmlElement>();
  const tokenLocations = new WeakMap<Token.Attribute[], Token.LocationWithAttributes>();
  const decodedStyleValues = new Map<number, string[]>();
  const sources = new Map<HtmlElement, HtmlElement>();
  const adoptedSources = new Map<HtmlElement, Token.LocationWithAttributes[]>();
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
    adoptAttributes(recipient, attrs) {
      const location = tokenLocations.get(attrs);
      if (location) {
        const locations = adoptedSources.get(recipient) ?? [];
        locations.push(location);
        adoptedSources.set(recipient, locations);
      }
      adapter.adoptAttributes(recipient, attrs);
    },
  };
  class SourceParser extends Parser<Htmlparser2TreeAdapterMap> {
    public override onStartTag(token: Token.TagToken): void {
      if (token.location) {
        tokenLocations.set(token.attrs, token.location);
        const location = token.location.attrs?.style;
        if (location) {
          const values = token.attrs.filter(({ name }) => name === 'style').map(({ value }) => value);
          decodedStyleValues.set(location.startOffset, [
            ...decodedStyleValues.get(location.startOffset) ?? [],
            ...values,
          ]);
        }
      }
      super.onStartTag(token);
    }
  }
  const parser = new SourceParser({ treeAdapter, sourceCodeLocationInfo: true, scriptingEnabled: false });
  parser.tokenizer.write(html, true);
  const document = parser.document;
  // Source recovery uses standards parsing; selectors still need the authored mode.
  adapter.setDocumentMode(document, authoredMode);
  const sourceElement: SourceElement = (element) => sources.get(element) ?? element;
  return { document, elements: documentElements(document), sourceElement, adoptedSources, decodedStyleValues };
}

export type CssHtmlDocument = ReturnType<typeof parseSourceDocument>;
