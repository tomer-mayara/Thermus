import { html as htmlNames, Parser, type Token } from 'parse5';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { documentElements, type HtmlDocument, type HtmlElement } from './css-visibility-selectors.ts';
import { HtmlTextSourceRanges } from './html-text-source-ranges.ts';

type TextNode = Htmlparser2TreeAdapterMap['textNode'];
export type SourceRange = { readonly start: number; readonly end: number };
export type StyleSource = { readonly range: SourceRange; readonly decodedValues: readonly string[] };

export class SourceHtmlDocument {
  public readonly document: HtmlDocument;
  public readonly elements: readonly HtmlElement[];
  private readonly textSources = new HtmlTextSourceRanges();
  private readonly decodedStyleValues = new Map<number, string[]>();
  private readonly sources = new Map<HtmlElement, HtmlElement>();
  private readonly adoptedSources = new Map<HtmlElement, Token.LocationWithAttributes[]>();

  private constructor(html: string) {
    const owner = this;
    const tokenSources = new WeakMap<Parameters<typeof adapter.createElement>[2], HtmlElement>();
    const tokenLocations = new WeakMap<Token.Attribute[], Token.LocationWithAttributes>();
    let authoredMode = htmlNames.DOCUMENT_MODE.NO_QUIRKS;
    const treeAdapter: typeof adapter = {
      ...owner.textSources.adapter,
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
        owner.sources.set(element, source);
        return element;
      },
      adoptAttributes(recipient, attrs) {
        const location = tokenLocations.get(attrs);
        if (location) {
          const locations = owner.adoptedSources.get(recipient) ?? [];
          locations.push(location);
          owner.adoptedSources.set(recipient, locations);
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
            owner.decodedStyleValues.set(location.startOffset, [
              ...owner.decodedStyleValues.get(location.startOffset) ?? [],
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
    this.document = document;
    this.elements = documentElements(document);
  }

  public static parse(html: string): SourceHtmlDocument {
    return new SourceHtmlDocument(html);
  }

  public sourceElement(element: HtmlElement): HtmlElement {
    return this.sources.get(element) ?? element;
  }

  public textRanges(node: TextNode): readonly SourceRange[] {
    return this.textSources.get(node).map(({ start, end }) => ({ start, end }));
  }

  public styleSources(element: HtmlElement): readonly StyleSource[] {
    const locations = [
      adapter.getNodeSourceCodeLocation(this.sourceElement(element)),
      ...this.adoptedSources.get(element) ?? [],
    ];
    const styles: StyleSource[] = [];
    for (const location of locations) {
      const style = location?.attrs?.style;
      if (!style) continue;
      styles.push({
        range: { start: style.startOffset, end: style.endOffset },
        decodedValues: [...this.decodedStyleValues.get(style.startOffset) ?? []],
      });
    }
    return styles;
  }

  public elementTagRanges(element: HtmlElement): readonly SourceRange[] {
    const ranges = (this.adoptedSources.get(element) ?? []).map((source) => ({
      start: source.startOffset, end: source.endOffset,
    }));
    const location = adapter.getNodeSourceCodeLocation(element);
    // A whole element interval can include visible nodes outside its parsed subtree.
    for (const source of [location?.startTag, location?.endTag]) {
      if (source) ranges.push({ start: source.startOffset, end: source.endOffset });
    }
    return ranges;
  }
}
