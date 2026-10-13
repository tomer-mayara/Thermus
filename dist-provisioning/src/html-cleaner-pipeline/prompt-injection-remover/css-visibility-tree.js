import { html as htmlNames, Parser } from 'parse5';
import { adapter } from 'parse5-htmlparser2-tree-adapter';
import { documentElements } from './css-visibility-selectors.js';
import { HtmlTextSourceRanges } from './html-text-source-ranges.js';
export class SourceHtmlDocument {
    document;
    elements;
    textSources = new HtmlTextSourceRanges();
    decodedStyleValues = new Map();
    sources = new Map();
    adoptedSources = new Map();
    constructor(html) {
        const owner = this;
        const tokenSources = new WeakMap();
        const tokenLocations = new WeakMap();
        let authoredMode = htmlNames.DOCUMENT_MODE.NO_QUIRKS;
        const treeAdapter = {
            ...owner.textSources.adapter,
            setDocumentMode(document, mode) {
                authoredMode = mode;
                const hasDoctype = document.children.some(adapter.isDocumentTypeNode);
                adapter.setDocumentMode(document, hasDoctype ? mode : htmlNames.DOCUMENT_MODE.NO_QUIRKS);
            },
            createElement(...args) {
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
        class SourceParser extends Parser {
            onStartTag(token) {
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
    static parse(html) {
        return new SourceHtmlDocument(html);
    }
    sourceElement(element) {
        return this.sources.get(element) ?? element;
    }
    textRanges(node) {
        return this.textSources.get(node).map(({ start, end }) => ({ start, end }));
    }
    styleSources(element) {
        const locations = [
            adapter.getNodeSourceCodeLocation(this.sourceElement(element)),
            ...this.adoptedSources.get(element) ?? [],
        ];
        const styles = [];
        for (const location of locations) {
            const style = location?.attrs?.style;
            if (!style)
                continue;
            styles.push({
                range: { start: style.startOffset, end: style.endOffset },
                decodedValues: [...this.decodedStyleValues.get(style.startOffset) ?? []],
            });
        }
        return styles;
    }
    elementTagRanges(element) {
        const ranges = (this.adoptedSources.get(element) ?? []).map((source) => ({
            start: source.startOffset, end: source.endOffset,
        }));
        const location = adapter.getNodeSourceCodeLocation(element);
        // A whole element interval can include visible nodes outside its parsed subtree.
        for (const source of [location?.startTag, location?.endTag]) {
            if (source)
                ranges.push({ start: source.startOffset, end: source.endOffset });
        }
        return ranges;
    }
}
//# sourceMappingURL=css-visibility-tree.js.map