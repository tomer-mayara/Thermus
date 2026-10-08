import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';

describe('WebsiteFetcherLightpanda', () => {
  let fetcher: WebsiteFetcherLightpanda;

  beforeEach(() => {
    fetcher = new WebsiteFetcherLightpanda();
  });

  test('fetchURL returns rendered HTML for a JavaScript page', async () => {
    const html = await fetcher.fetchURL('https://quotes.toscrape.com/js/');

    // console.log(html); // Log the HTML content for debugging purposes
    assert.match(html, /<html[\s>]/i);
    assert.match(html, /<small class=['"]author['"]>Albert Einstein<\/small>/);
  });

  test('fetchURL returns rendered HTML for these pages', async () => {
    const pages: { url: string; expected: RegExp }[] = [
      {
        url: 'https://quotes.toscrape.com',
        expected: /<small class=['"]author['"][^>]*>Albert Einstein<\/small>/,
      },
      {
        url: 'https://web-scraping.dev/products',
        expected: /Box of Chocolate Candy/,
      },
      {
        url: 'https://web-scraping.dev/js-links',
        expected: /<a href=['"]\/js-links-target['"]>js target<\/a>/,
      },
    ];

    for (const page of pages) {
      const html = await fetcher.fetchURL(page.url);
      assert.match(html, /<html[\s>]/i, page.url);
      assert.match(html, page.expected, page.url);
    }
  });
});
