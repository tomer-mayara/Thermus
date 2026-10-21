import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';

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
    const block = link.closest('p, h1, h2, h3, h4, h5, h6');
    if (!block || block.querySelectorAll('a[href]').length !== 1) return false;
    const following = block.nextElementSibling;
    return [block, following].some((paragraph) => {
      if (!paragraph || paragraph.tagName !== 'P'
        || (paragraph !== block && paragraph.querySelector('a[href]'))) return false;
      const copy = paragraph.cloneNode(true) as typeof paragraph;
      for (const anchor of copy.querySelectorAll('a')) anchor.remove();
      const text = copy.textContent.replace(/\s+/g, ' ').trim();
      return text.length >= 50 && /browser|headless|automation|\bZig\b/i.test(text);
    });
  });
  assert.ok(associatedDescription, 'Expected a useful description in the result paragraph or its immediately following paragraph');
}
