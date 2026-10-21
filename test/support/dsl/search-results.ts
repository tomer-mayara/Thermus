import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';

export function assertCleanSearchResults(markdown: string, expected: readonly { title: string; url: string; snippet: string }[]): void {
  const document = parseHTML(`<html><body>${micromark(markdown)}</body></html>`).document;
  const lists = [...document.body.querySelectorAll(':scope > ol')];
  assert.equal(lists.length, 1, 'Expected one numbered list of organic results');
  const rows = [...lists[0].querySelectorAll(':scope > li')];
  assert.equal(rows.length, expected.length, 'Expected one row for each organic result');
  assert.equal(document.querySelectorAll('img').length, 0, 'Results must contain no images');
  assert.doesNotMatch(markdown, /!\[/u, 'Results must contain no Markdown image syntax');
  const normalize = (text: string) => text.replace(/\s+/gu, ' ').trim();
  for (const [index, entry] of expected.entries()) {
    const row = rows[index];
    const title = row.querySelector('a[href]');
    assert.ok(title, `Missing title link in result ${index + 1}`);
    assert.equal(normalize(title.textContent), entry.title, 'The title must exclude site labels and breadcrumbs');
    assert.equal(title.getAttribute('href'), entry.url, `Wrong destination for ${entry.title}`);
    const text = normalize(row.textContent);
    assert.ok(text.includes(entry.snippet), `Missing associated description for ${entry.title}`);
  }
  lists[0].remove();
  assert.equal(document.body.children.length, 0, 'Only the numbered results list may appear at the top level');
  assert.equal(normalize(document.body.textContent), '', 'No unrelated text may appear outside results');
}

export function assertUsefulLightpandaResult(markdown: string): void {
  const document = parseHTML(`<html><body>${micromark(markdown)}</body></html>`).document;
  const resultLinks = [...document.querySelectorAll('a[href]')].filter((link) => {
    const destination = new URL(link.getAttribute('href') ?? '', 'https://search.brave.com/');
    const title = link.textContent.replace(/\s+/g, ' ').trim();
    return ['https:', 'http:'].includes(destination.protocol)
      && destination.hostname !== 'brave.com' && !destination.hostname.endsWith('.brave.com')
      && /lightpanda/i.test(title) && title.length >= 12;
  });
  assert.ok(resultLinks.length > 0, 'Expected an external result link with a useful Lightpanda title');
  const associatedDescription = resultLinks.some((link) => {
    const row = link.closest('li');
    return row ? hasRowDescription(link, row) : hasParagraphDescription(link);
  });
  assert.ok(associatedDescription, 'Expected a useful description in the result paragraph or its immediately following paragraph');
}

type HtmlElement = ReturnType<typeof parseHTML>['document']['body'];

function hasRowDescription(link: HtmlElement, row: HtmlElement): boolean {
  const titleBlock = link.closest('p') ?? row;
  if (titleBlock.querySelectorAll('a[href]').length !== 1 || row.querySelector('li')) return false;
  return [titleBlock, titleBlock.nextElementSibling].some((paragraph) => {
    if (!paragraph || paragraph.closest('li') !== row
      || (paragraph !== titleBlock && paragraph.tagName !== 'P')) return false;
    const copy = paragraph.cloneNode(true) as typeof paragraph;
    if (paragraph === titleBlock) {
      for (const anchor of copy.querySelectorAll('a')) anchor.remove();
    }
    const text = copy.textContent.replace(/\s+/g, ' ').trim();
    return text.length >= 50 && /browser|headless|automation|\bZig\b/i.test(text);
  });
}

function hasParagraphDescription(link: HtmlElement): boolean {
  const block = link.closest('p, h1, h2, h3, h4, h5, h6');
  if (!block || block.querySelectorAll('a[href]').length !== 1) return false;
  return [block, block.nextElementSibling].some((paragraph) => {
    if (!paragraph || paragraph.tagName !== 'P'
      || (paragraph !== block && paragraph.querySelector('a[href]'))) return false;
    const copy = paragraph.cloneNode(true) as typeof paragraph;
    for (const anchor of copy.querySelectorAll('a')) anchor.remove();
    const text = copy.textContent.replace(/\s+/g, ' ').trim();
    return text.length >= 50 && /browser|headless|automation|\bZig\b/i.test(text);
  });
}
