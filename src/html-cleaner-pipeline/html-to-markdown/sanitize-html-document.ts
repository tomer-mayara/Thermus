import type { applyLayer1 } from 'agent-input-sanitizer';
import { type DOMParser, NodeFilter } from 'linkedom';

export type SanitizeText = (text: string, onDelete?: Parameters<typeof applyLayer1>[1]) => string;

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

export function sanitizeHtmlDocument(
  root: ParsedDocument | HtmlElement,
  sanitizeText: SanitizeText,
): void {
  const document = root.ownerDocument ?? root as ParsedDocument;
  preserveNoscriptText(root, document);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let block: HtmlElement | null = null;
  let run: HtmlText[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const text = run.map((node) => node.data).join('');
    sanitizeText(text, (ranges) => applyTextDeletions(run, ranges));
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

function preserveNoscriptText(root: ParsedDocument | HtmlElement, document: ParsedDocument): void {
  const figureTextAnchors = new Map<HtmlElement, HtmlElement>();
  for (const noscript of root.querySelectorAll('noscript')) {
    if (noscript.parentElement?.closest('noscript')) continue;
    preserveNoscriptElement(noscript, document, figureTextAnchors);
  }
}

function preserveNoscriptElement(
  noscript: HtmlElement, document: ParsedDocument, figureTextAnchors: Map<HtmlElement, HtmlElement>,
): void {
  const hasImage = noscript.querySelector('img') !== null;
  if (hasImage && !noscript.textContent) return;
  const figure = noscript.closest('figure');
  // LinkeDOM has already decoded this text. Defuddle must not parse it as HTML.
  const content = document.createElement(figure ? 'div' : 'span', {});
  copyNoscriptContent(noscript, content);
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

function copyNoscriptContent(noscript: HtmlElement, content: HtmlElement): void {
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

function applyTextDeletions(
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
