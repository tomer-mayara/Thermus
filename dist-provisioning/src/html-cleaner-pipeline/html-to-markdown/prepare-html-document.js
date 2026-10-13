import { randomUUID } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { sanitizeHtmlDocument } from './sanitize-html-document.js';
const headElements = new Set(['TITLE', 'META', 'LINK', 'BASE', 'STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);
export class PreparedHtmlDocument {
    document;
    originalUrl;
    isFragment;
    constructor(document, originalUrl, isFragment) {
        this.document = document;
        this.originalUrl = originalUrl;
        this.isFragment = isFragment;
    }
    static fromHtml(html, url) {
        const { document } = parseHTML(html);
        const isFragment = document.documentElement?.localName !== 'html' || !document.querySelector('body');
        return new PreparedHtmlDocument(document, url, isFragment);
    }
    async extract(sanitizeText) {
        const document = this.document;
        normalizeDocument(document);
        sanitizeHtmlDocument(document, sanitizeText);
        const preserveSuppliedContent = this.isFragment || !hasBodyContent(document);
        const codeStartMarker = `code-start-${randomUUID()}:\n`;
        if (preserveSuppliedContent) {
            preserveFragmentHeadings(document);
            normalizeFragmentCode(document, codeStartMarker);
        }
        prepareLocalExtraction(document, this.originalUrl);
        const hasScriptContent = [...document.querySelectorAll('script:not([type="application/ld+json"])')]
            .some((script) => script.textContent?.trim());
        const extractionUrl = this.isFragment || (preserveSuppliedContent && !hasScriptContent)
            ? 'about:blank' : this.originalUrl;
        const result = await Defuddle(document, extractionUrl, {
            markdown: true,
            useAsync: false,
            processExtractedDom: (root) => sanitizeHtmlDocument(root, sanitizeText),
            standardize: !preserveSuppliedContent,
            removeContentPatterns: !preserveSuppliedContent,
            removeExactSelectors: !preserveSuppliedContent,
            removePartialSelectors: !preserveSuppliedContent,
            removeLowScoring: !preserveSuppliedContent,
            contentSelector: preserveSuppliedContent ? 'body' : undefined,
        });
        return {
            content: (result.content ?? '')
                .replace(new RegExp(`^[\\t >]*${codeStartMarker}`, 'gm'), '')
                .replaceAll(codeStartMarker.trimEnd(), ''),
            title: result.title ?? '',
        };
    }
}
function ensureDocumentRoot(document) {
    if (document.documentElement?.localName !== 'html') {
        const nodes = [...document.childNodes];
        const root = document.createElement('html');
        document.appendChild(root);
        for (const node of nodes) {
            if (node.nodeType !== document.DOCUMENT_TYPE_NODE) {
                root.appendChild(node);
            }
        }
    }
}
function normalizeDocument(document) {
    ensureDocumentRoot(document);
    // LinkeDOM inserts missing head and body elements through these getters after the root exists.
    const head = document.head;
    const body = document.body;
    let bodyAnchor = body.firstChild;
    for (const node of [...document.documentElement.childNodes]) {
        if (node === body) {
            bodyAnchor = null;
            continue;
        }
        if (node === head) {
            continue;
        }
        if (node.nodeName === 'HEAD' || node.nodeName === 'BODY') {
            const target = node.nodeName === 'HEAD' ? head : body;
            for (const child of [...node.childNodes]) {
                target.appendChild(child);
            }
            node.remove();
        }
        else if (node.nodeName !== 'NOSCRIPT' && headElements.has(node.nodeName)) {
            head.appendChild(node);
        }
        else {
            body.insertBefore(node, bodyAnchor);
        }
    }
    moveImpliedBodyContent(document);
}
function moveImpliedBodyContent(document) {
    const firstBodyNode = document.body.firstChild;
    let bodyStarted = false;
    // LinkeDOM keeps body content in head when the head end tag is omitted.
    for (const node of [...document.head.childNodes]) {
        const isBodyText = node.nodeType === document.TEXT_NODE && Boolean(node.textContent?.trim());
        const isBodyElement = node.nodeType === document.ELEMENT_NODE && !headElements.has(node.nodeName);
        bodyStarted ||= isBodyText || isBodyElement;
        if (bodyStarted) {
            document.body.insertBefore(node, firstBodyNode);
        }
    }
}
function hasBodyContent(document) {
    const body = document.body.cloneNode(true);
    for (const node of body.querySelectorAll('script, style, noscript, template')) {
        node.remove();
    }
    return Boolean(body.textContent?.trim() || body.querySelector('img, picture, video, audio, iframe, svg, math, hr'));
}
function prepareLocalExtraction(document, url) {
    // Keep the page URL for metadata and relative links when extraction uses a neutral URL.
    Object.defineProperty(document, 'URL', { value: url, configurable: true });
    const base = document.head.querySelector('base[href]') ?? document.createElement('base');
    let baseUrl = url;
    try {
        baseUrl = new URL(base.getAttribute('href') || url, url).href;
    }
    catch {
        baseUrl = url;
    }
    base.setAttribute('href', baseUrl);
    if (!base.parentNode) {
        document.head.appendChild(base);
    }
    // The generic BBCode extractor reads replacement content from this attribute.
    document.querySelector('#application_config')?.removeAttribute('data-partnereventstore');
    removeSchemaBodyText(document);
}
function removeSchemaBodyText(document) {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
            const json = (script.textContent ?? '')
                .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
                .replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (token) => token.startsWith('"') ? token : '');
            const metadata = JSON.parse(json, (key, value) => key === 'articleBody' || key === 'text' ? undefined : value);
            // Defuddle removes comments before it reads JSON. Keep slashes encoded in strings.
            script.textContent = JSON.stringify(metadata).replaceAll('/', '\\u002f');
        }
        catch {
            script.remove();
        }
    }
}
function normalizeFragmentCode(document, codeStartMarker) {
    for (const code of document.body.querySelectorAll('code')) {
        const preservesWhitespace = /(?:^|;)\s*white-space\s*:\s*(?:pre(?:-wrap)?|break-spaces)(?:\s*!important)?\s*(?:;|$)/i.test(code.getAttribute('style') ?? '');
        if (!code.closest('pre') && preservesWhitespace) {
            const pre = document.createElement('pre');
            code.replaceWith(pre);
            pre.appendChild(code);
        }
    }
    normalizePreformattedBlocks(document, codeStartMarker);
}
function normalizePreformattedBlocks(document, codeStartMarker) {
    // Defuddle's Markdown converter requires a code child to make a fenced block.
    for (const pre of document.body.querySelectorAll('pre')) {
        for (const lineBreak of pre.querySelectorAll('br')) {
            lineBreak.replaceWith(document.createTextNode('\n'));
        }
        const code = pre.querySelector('code') ?? document.createElement('code');
        if (pre.childNodes.length !== 1 || pre.firstChild !== code) {
            for (const child of pre.querySelectorAll('code')) {
                child.replaceWith(...child.childNodes);
            }
            code.replaceChildren(...pre.childNodes);
            pre.appendChild(code);
        }
        // Defuddle trims code text. Protect its initial whitespace until Markdown is complete.
        if (code.textContent?.trim()) {
            code.prepend(document.createTextNode(codeStartMarker));
        }
    }
}
function preserveFragmentHeadings(document) {
    const firstHeading = document.body.querySelector('h1');
    if (firstHeading && !document.querySelector('title')) {
        document.title = firstHeading.textContent?.trim() ?? '';
    }
    // Defuddle removes a leading h1 from Markdown. Keep fragment headings as h2.
    for (const heading of document.body.querySelectorAll('h1')) {
        const replacement = document.createElement('h2');
        for (const attribute of heading.attributes) {
            replacement.setAttribute(attribute.name, attribute.value);
        }
        replacement.append(...heading.childNodes);
        heading.replaceWith(replacement);
    }
}
//# sourceMappingURL=prepare-html-document.js.map