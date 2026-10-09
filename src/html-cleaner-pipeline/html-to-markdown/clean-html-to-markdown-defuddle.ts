import { applyLayer1, sanitize } from 'agent-input-sanitizer';
import { Defuddle } from 'defuddle/node';
import { type DOMParser, NodeFilter, parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

type HtmlDocument = ReturnType<DOMParser['parseFromString']>;
type HtmlText = ReturnType<HtmlDocument['createTextNode']>;
type HtmlElement = ReturnType<HtmlDocument['createElement']>;

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

    const { document } = parseHTML(ctx.html);
    this.sanitizeDocument(document, sanitizeText);
    const result = await Defuddle(document, ctx.finalUrl, {
      markdown: true,
      useAsync: false,
      processExtractedDom: (root) => this.sanitizeDocument(root, sanitizeText),
    });
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

  private sanitizeDocument(
    root: HtmlDocument | HtmlElement,
    sanitizeText: (text: string, onDelete?: Parameters<typeof applyLayer1>[1]) => string,
  ): void {
    const document = root.ownerDocument ?? root as HtmlDocument;
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

  private preserveNoscriptText(root: HtmlDocument | HtmlElement, document: HtmlDocument): void {
    const figureTextAnchors = new Map<HtmlElement, HtmlElement>();
    for (const noscript of root.querySelectorAll('noscript')) {
      if (noscript.parentElement?.closest('noscript')) continue;
      this.preserveNoscriptElement(noscript, document, figureTextAnchors);
    }
  }

  private preserveNoscriptElement(
    noscript: HtmlElement, document: HtmlDocument, figureTextAnchors: Map<HtmlElement, HtmlElement>,
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
