import { parseHTML } from 'linkedom';
import type { HtmlProcessingContext } from '../html-to-markdown-pipeline.ts';
import { BraveResultFields } from './brave-result-fields.ts';

type HtmlDocument = ReturnType<typeof parseHTML>['document'];
type HtmlElement = HtmlDocument['body'];
const inlineTags = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 's', 'del', 'code', 'small', 'mark', 'br']);
const blockTags = new Set(['div', 'p']);
const nonDisplayAncestors = 'template, noscript, script, style, head, [hidden]';

export class BraveResultDocument {
  private readonly source: HtmlDocument;
  private readonly output = parseHTML('<html><head></head><body></body></html>').document;
  private readonly list = this.output.createElement('ol');
  private readonly fields: BraveResultFields;

  public constructor(private readonly input: HtmlProcessingContext) {
    this.source = parseHTML(input.html).document;
    this.fields = new BraveResultFields(input.finalUrl);
    this.output.body.appendChild(this.list);
  }

  public async project(): Promise<HtmlProcessingContext> {
    const base = await this.fields.base(this.source.querySelector('head base[href]')?.getAttribute('href') ?? '');
    for (const card of this.source.querySelectorAll('main#search-page section#mixed-main .snippet[data-type="web"]')) {
      if (card.closest(nonDisplayAncestors)) continue;
      const row = await this.resultRow(card, base);
      if (row) this.list.appendChild(row);
    }
    return {
      ...this.input,
      html: this.list.childElementCount ? this.output.toString() : '',
      found: [...new Set([...(this.input.found ?? []), ...this.fields.found])],
      warnings: [...new Set([...(this.input.warnings ?? []), ...this.fields.warnings])],
    };
  }

  private async resultRow(card: HtmlElement, base: string): Promise<HtmlElement | undefined> {
    const titleNode = card.querySelector('.result-content > a.l1[href] > .title.search-snippet-title');
    if (!titleNode) return undefined;
    const titleCopy = this.output.createElement('span');
    await this.copyInline(titleNode, titleCopy, base);
    const title = (await this.fields.clean(titleCopy.textContent ?? '')).trim();
    const url = await this.fields.destination(titleNode.parentElement?.getAttribute('href') ?? '', base);
    if (!title || !url) return undefined;
    const row = this.output.createElement('li');
    const anchor = this.output.createElement('a');
    anchor.setAttribute('href', url);
    anchor.textContent = title;
    row.appendChild(anchor);
    const description = card.querySelector('.generic-snippet .content, '
      + '.result-content > .video-snippet[data-macro="video"] > .content > .desktop-default-regular.line-clamp-2');
    if (description) await this.appendDescription(description, row, base);
    return row;
  }

  private async appendDescription(description: HtmlElement, row: HtmlElement, base: string): Promise<void> {
    const paragraph = this.output.createElement('p');
    await this.copyInline(description, paragraph, base);
    if (paragraph.textContent?.trim()) row.appendChild(paragraph);
  }

  private async copyInline(source: HtmlElement, target: HtmlElement, base: string): Promise<void> {
    if (source.closest(nonDisplayAncestors)) return;
    for (const node of source.childNodes) {
      if (node.nodeType === node.TEXT_NODE) target.appendChild(this.output.createTextNode(node.textContent ?? ''));
      else if (node.nodeType === node.ELEMENT_NODE) await this.copyElement(node as HtmlElement, target, base);
    }
  }

  private async copyElement(element: HtmlElement, target: HtmlElement, base: string): Promise<void> {
    const tag = element.localName;
    if ((!inlineTags.has(tag) && !blockTags.has(tag)) || element.hasAttribute('hidden')) return;
    const copy = await this.inlineElement(element, base);
    if (blockTags.has(tag)) target.appendChild(this.output.createTextNode(' '));
    await this.copyInline(element, copy, base);
    target.appendChild(copy);
    if (blockTags.has(tag)) target.appendChild(this.output.createTextNode(' '));
  }

  private async inlineElement(element: HtmlElement, base: string): Promise<HtmlElement> {
    const tag = element.localName;
    const url = tag === 'a' ? await this.fields.destination(element.getAttribute('href') ?? '', base) : undefined;
    const copy = this.output.createElement(blockTags.has(tag) || (tag === 'a' && !url) ? 'span' : tag);
    if (url) copy.setAttribute('href', url);
    return copy;
  }
}
