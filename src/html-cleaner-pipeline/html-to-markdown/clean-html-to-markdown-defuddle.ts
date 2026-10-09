import { randomUUID } from 'node:crypto';
import { applyLayer1, sanitize } from 'agent-input-sanitizer';
import { Defuddle } from 'defuddle/node';
import { type DOMParser, NodeFilter, parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';
import { plainTextMarkdown } from './plain-text-input.ts';

const headElements = new Set(['TITLE', 'META', 'LINK', 'BASE', 'STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);

type HtmlDocument = ReturnType<typeof parseHTML>['document'];
type ParsedDocument = ReturnType<DOMParser['parseFromString']>;
type HtmlText = ReturnType<ParsedDocument['createTextNode']>;
type HtmlElement = ReturnType<ParsedDocument['createElement']>;

const textBoundaries = [
  'address', 'article', 'aside', 'blockquote', 'body', 'br', 'caption', 'dd', 'details',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'img', 'li', 'main',
  'nav', 'ol', 'p', 'pre', 'script', 'section', 'style', 'summary', 'table',
  'tbody', 'td', 'textarea', 'th', 'thead', 'title', 'tr', 'ul',
].join(',');

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const reports: ReturnType<typeof sanitize>[] = [];
    const sanitizeText = (text: string, onDelete?: Parameters<typeof applyLayer1>[1]): string => {
      // DOM fields are inside the HTML input, so a leading BOM is not a file BOM.
      const input = ' ' + text;
      const { cleaned } = applyLayer1(input, onDelete);
      if (!cleaned.startsWith(' ')) {
        throw new Error('Sanitizer changed the text boundary prefix');
      }
      if (cleaned !== input) reports.push(sanitize(input));
      return cleaned.slice(1);
    };

    const plainMarkdown = plainTextMarkdown(ctx.html, sanitizeText);
    const result = plainMarkdown === undefined
      ? await this.convertHtml(ctx, sanitizeText)
      : { content: plainMarkdown, title: '' };
    const [markdown, title, ...decodedReports] = await Promise.all([
      sanitize(result.content),
      sanitize(result.title),
      ...reports,
    ]);
    const allReports = [...decodedReports, markdown, title];
    const detected = new Set(allReports.flatMap((report) => report.found));
    const notices = new Set(allReports.flatMap((report) => report.warnings));
    const found = [...detected]
      .filter((category) => !ctx.found?.includes(category));
    const warnings = [...notices]
      .filter((warning) => !ctx.warnings?.includes(warning));

    return {
      ...ctx,
      markdown: markdown.cleaned,
      title: title.cleaned,
      skipped: ctx.skipped + found.length,
      found: [...(ctx.found ?? []), ...found],
      warnings: [...(ctx.warnings ?? []), ...warnings],
    };
  }

  private async convertHtml(
    ctx: Ctx,
    sanitizeText: (text: string, onDelete?: Parameters<typeof applyLayer1>[1]) => string,
  ): Promise<{ content: string; title: string }> {
    const { document } = parseHTML(ctx.html);
    const isFragment = document.documentElement?.localName !== 'html' || !document.querySelector('body');
    CleanHtmlToMarkdownDefuddle.normalizeDocument(document);
    this.sanitizeDocument(document, sanitizeText);
    const preserveSuppliedContent = isFragment || !CleanHtmlToMarkdownDefuddle.hasBodyContent(document);
    const codeStartMarker = `code-start-${randomUUID()}:\n`;
    if (preserveSuppliedContent) {
      CleanHtmlToMarkdownDefuddle.preserveFragmentHeadings(document);
      CleanHtmlToMarkdownDefuddle.normalizeFragmentCode(document, codeStartMarker);
    }
    CleanHtmlToMarkdownDefuddle.prepareLocalExtraction(document, ctx.finalUrl);

    const hasScriptContent = [...document.querySelectorAll('script:not([type="application/ld+json"])')]
      .some((script) => script.textContent?.trim());
    const extractionUrl = isFragment || (preserveSuppliedContent && !hasScriptContent)
      ? 'about:blank'
      : ctx.finalUrl;
    const result = await Defuddle(document, extractionUrl, {
      markdown: true,
      useAsync: false,
      processExtractedDom: (root) => this.sanitizeDocument(root, sanitizeText),
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

  private static ensureDocumentRoot(document: HtmlDocument): void {
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

  private static normalizeDocument(document: HtmlDocument): void {
    CleanHtmlToMarkdownDefuddle.ensureDocumentRoot(document);
    // LinkeDOM inserts missing head and body elements through these getters after the root exists.
    const head = document.head;
    const body = document.body;
    for (const node of [...document.documentElement.childNodes]) {
      if (node === head || node === body) {
        continue;
      }
      if (node.nodeName === 'HEAD' || node.nodeName === 'BODY') {
        const target = node.nodeName === 'HEAD' ? head : body;
        for (const child of [...node.childNodes]) {
          target.appendChild(child);
        }
        node.remove();
      } else if (headElements.has(node.nodeName)) {
        head.appendChild(node);
      } else {
        body.appendChild(node);
      }
    }
    CleanHtmlToMarkdownDefuddle.moveImpliedBodyContent(document);
  }

  private static moveImpliedBodyContent(document: HtmlDocument): void {
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

  private static hasBodyContent(document: HtmlDocument): boolean {
    const body = document.body.cloneNode(true) as HtmlDocument['body'];
    for (const node of body.querySelectorAll('script, style, noscript, template')) {
      node.remove();
    }
    return Boolean(body.textContent?.trim() || body.querySelector('img, picture, video, audio, iframe, svg, math, hr'));
  }

  private static prepareLocalExtraction(document: HtmlDocument, url: string): void {
    // Keep the page URL for metadata and relative links when extraction uses a neutral URL.
    Object.defineProperty(document, 'URL', { value: url, configurable: true });
    const base = document.head.querySelector('base[href]') ?? document.createElement('base');
    let baseUrl = url;
    try {
      baseUrl = new URL(base.getAttribute('href') || url, url).href;
    } catch {
      baseUrl = url;
    }
    base.setAttribute('href', baseUrl);
    if (!base.parentNode) {
      document.head.appendChild(base);
    }
    // The generic BBCode extractor reads replacement content from this attribute.
    document.querySelector('#application_config')?.removeAttribute('data-partnereventstore');
    CleanHtmlToMarkdownDefuddle.removeSchemaBodyText(document);
  }

  private static removeSchemaBodyText(document: HtmlDocument): void {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = (script.textContent ?? '')
          .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
          .replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
            (token: string) => token.startsWith('"') ? token : '');
        const metadata: unknown = JSON.parse(json, (key, value: unknown) =>
          key === 'articleBody' || key === 'text' ? undefined : value,
        );
        // Defuddle removes comments before it reads JSON. Keep slashes encoded in strings.
        script.textContent = JSON.stringify(metadata).replaceAll('/', '\\u002f');
      } catch {
        script.remove();
      }
    }
  }

  private static normalizeFragmentCode(document: HtmlDocument, codeStartMarker: string): void {
    for (const code of document.body.querySelectorAll('code')) {
      const preservesWhitespace = /(?:^|;)\s*white-space\s*:\s*(?:pre(?:-wrap)?|break-spaces)(?:\s*!important)?\s*(?:;|$)/i.test(code.getAttribute('style') ?? '');
      if (!code.closest('pre') && preservesWhitespace) {
        const pre = document.createElement('pre');
        code.replaceWith(pre);
        pre.appendChild(code);
      }
    }
    CleanHtmlToMarkdownDefuddle.normalizePreformattedBlocks(document, codeStartMarker);
  }

  private static normalizePreformattedBlocks(document: HtmlDocument, codeStartMarker: string): void {
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

  private static preserveFragmentHeadings(document: HtmlDocument): void {
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

  private sanitizeDocument(
    root: ParsedDocument | HtmlElement,
    sanitizeText: (text: string, onDelete?: Parameters<typeof applyLayer1>[1]) => string,
  ): void {
    const document = root.ownerDocument ?? root as ParsedDocument;
    this.preserveNoscriptText(root, document);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let block: HtmlElement | null = null;
    let run: HtmlText[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const text = run.map((node) => node.data).join('');
      sanitizeText(text, (ranges) => this.applyTextDeletions(run, ranges));
      run = [];
    };
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === node.TEXT_NODE) {
        const text = node as HtmlText;
        const nextBlock = text.parentElement?.closest(textBoundaries) ?? null;
        if (nextBlock !== block) flush();
        block = nextBlock;
        run.push(text);
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const element = node as HtmlElement;
        if (element.matches(textBoundaries)) flush();
        for (const attribute of element.attributes) {
          attribute.value = sanitizeText(attribute.value);
        }
      }
    }
    flush();
  }

  private preserveNoscriptText(root: ParsedDocument | HtmlElement, document: ParsedDocument): void {
    const figureTextAnchors = new Map<HtmlElement, HtmlElement>();
    for (const noscript of root.querySelectorAll('noscript')) {
      if (noscript.parentElement?.closest('noscript')) continue;
      this.preserveNoscriptElement(noscript, document, figureTextAnchors);
    }
  }

  private preserveNoscriptElement(
    noscript: HtmlElement, document: ParsedDocument, figureTextAnchors: Map<HtmlElement, HtmlElement>,
  ): void {
    const hasImage = noscript.querySelector('img') !== null;
    if (hasImage && !noscript.textContent) return;
    const figure = noscript.closest('figure');
    // LinkeDOM has already decoded this text. Defuddle must not parse it as HTML.
    const content = document.createElement(figure ? 'div' : 'span', {});
    this.copyNoscriptContent(noscript, content);
    if (figure) {
      // Defuddle reduces image figures to an image and a caption.
      const anchor = figureTextAnchors.get(figure) ?? figure;
      anchor.after(content);
      figureTextAnchors.set(figure, content);
      if (!hasImage) noscript.remove();
    } else if (hasImage) {
      noscript.after(content);
    } else {
      noscript.replaceWith(content);
    }
  }

  private copyNoscriptContent(noscript: HtmlElement, content: HtmlElement): void {
    const copy = noscript.cloneNode(true) as HtmlElement;
    if (copy.querySelector('img')) {
      for (const image of copy.querySelectorAll('img, source')) image.remove();
    }
    for (const nested of copy.querySelectorAll('noscript')) {
      while (nested.firstChild) nested.before(nested.firstChild);
      nested.remove();
    }
    while (copy.firstChild) content.appendChild(copy.firstChild);
    // Extractor callbacks can visit this image tree again after serialization.
    const walker = noscript.ownerDocument.createTreeWalker(noscript, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) node.nodeValue = '';
  }

  private applyTextDeletions(
    nodes: readonly HtmlText[], deletions: { start: number; end: number }[],
  ): void {
    const ranges = deletions.map(({ start, end }) => {
      if (start < 1) throw new Error('Sanitizer removed the text boundary prefix');
      return { from: start - 1, to: end - 1 };
    });
    let offset = 0;
    let rangeIndex = 0;
    for (const node of nodes) {
      const end = offset + node.data.length;
      const parts: string[] = [];
      let cursor = 0;
      while (rangeIndex < ranges.length && ranges[rangeIndex].from < end) {
        const range = ranges[rangeIndex];
        parts.push(node.data.slice(cursor, Math.max(0, range.from - offset)));
        cursor = Math.min(node.data.length, range.to - offset);
        if (range.to > end) break;
        rangeIndex++;
      }
      parts.push(node.data.slice(cursor));
      node.data = parts.join('');
      offset = end;
    }
  }
}
