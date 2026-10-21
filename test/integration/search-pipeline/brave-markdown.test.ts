import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import { SearchEngineBraveHttp } from '../../../src/pipelines/providers/search-engine/search-engine-brave-http.ts';
import { CleanHtmlAdsAdblockRs } from '../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { BraveHTTPResultCleanup } from '../../../src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts';
import type { WebsiteFetchResult } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

interface ExpectedResult {
  title: string;
  url: string;
  snippet: string;
}

class CapturedBraveResults {
  readonly metadata = JSON.parse(readFileSync(new URL('test/support/fixtures/search-engine/brave-results.json', repositoryRoot), 'utf8')) as { query: string; requestedUrl: string; finalUrl: string };
  readonly expected = JSON.parse(readFileSync(new URL('test/support/fixtures/search-engine/brave-results-expected.json', repositoryRoot), 'utf8')) as ExpectedResult[];
  readonly page: WebsiteFetchResult = {
    requestedUrl: this.metadata.requestedUrl,
    finalUrl: this.metadata.finalUrl,
    html: readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8'),
  };

  async clean(page = this.page, rules = '') {
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => page });
    const document = await engine.search(this.metadata.query, new AbortController().signal);
    assert.equal(document.kind, 'results');
    assert.equal(document.page, page);
    const pipeline = new HtmlToMarkdownPipeline([
      new CleanHtmlAdsAdblockRs(rules),
      new PromptInjectionRemoverSanitizer(),
      new BraveHTTPResultCleanup(),
      new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true }),
    ]);
    return pipeline.process(document.page);
  }

  assertFidelity(markdown: string): void {
    const { document } = parseHTML(`<html><body>${micromark(markdown)}</body></html>`);
    const text = document.body.textContent.replace(/\s+/g, ' ').trim();
    const links = [...document.querySelectorAll('a[href]')];
    let previousLink = -1;
    let previousText = -1;
    assert.equal(this.expected.length, 18);
    for (const result of this.expected) {
      const index = links.findIndex((link, position) => position > previousLink
        && link.getAttribute('href') === result.url
        && link.textContent.replace(/\s+/g, ' ').trim().includes(result.title));
      assert.ok(index > previousLink, `Missing or reordered result link: ${result.title}`);
      const titleIndex = text.indexOf(result.title, previousText + 1);
      assert.ok(titleIndex > previousText, `Missing or reordered title: ${result.title}`);
      const snippetIndex = text.indexOf(result.snippet, titleIndex + result.title.length);
      assert.ok(snippetIndex >= 0, `Missing snippet: ${result.title}`);
      previousLink = index;
      previousText = snippetIndex;
    }
  }
}

test('Given the full captured Brave results page, when the real engine and incoming cleaners run, then all eighteen safe result titles, destinations, and snippets stay in order', async () => {
  const captured = new CapturedBraveResults();
  const original = { ...captured.page };
  assert.match(captured.page.html, /<head[\s>]/);
  assert.match(captured.page.html, /<style[\s>]/);
  assert.match(captured.page.html, /<body[\s>]/);

  const result = await captured.clean();

  assert.equal(result.scanWithholding, undefined);
  assert.equal(typeof result.markdown, 'string');
  captured.assertFidelity(result.markdown ?? '');
  const rendered = parseHTML(`<html><body>${micromark(result.markdown ?? '')}</body></html>`).document;
  assert.equal(rendered.querySelectorAll('body > ol').length, 1);
  assert.equal(rendered.querySelectorAll('body > ol > li').length, 18);
  assert.equal(rendered.querySelector('img'), null);
  assert.deepEqual(captured.page, original);
});

for (const base of [
  { label: 'no base', href: undefined, target: 'https://search.brave.com/relative-target' },
  { label: 'a relative base', href: '../guides/', target: 'https://search.brave.com/guides/relative-target' },
  { label: 'an invalid base', href: 'http://[', target: 'https://search.brave.com/relative-target' },
]) {
  test(`Given the captured Brave page with marked safety targets and ${base.label}, when incoming cleaning runs, then safe links resolve against the final page and unsafe content is removed`, async () => {
    const captured = new CapturedBraveResults();
    const { document } = parseHTML(captured.page.html);
    document.head.insertAdjacentHTML('beforeend', '<style>.search-test-hidden { display: none; }</style>');
    if (base.href !== undefined) document.head.insertAdjacentHTML('afterbegin', `<base href="${base.href}">`);
    const firstSnippet = document.querySelector('#mixed-main .snippet[data-type="web"] .generic-snippet .content');
    assert.ok(firstSnippet);
    firstSnippet.insertAdjacentHTML('beforeend', '<p><a href="relative-target">Search test relative link</a></p>'
      + '<div class="search-test-hidden">search-test-hidden-instruction</div>'
      + '<div id="search-test-ad">search-test-ad-content</div>');
    const page = { ...captured.page, html: document.toString() };
    const original = { ...page };

    const result = await captured.clean(page, 'search.brave.com###search-test-ad');

    assert.equal(result.scanWithholding, undefined);
    captured.assertFidelity(result.markdown ?? '');
    const rendered = parseHTML(`<html><body>${micromark(result.markdown ?? '')}</body></html>`).document;
    const link = [...rendered.querySelectorAll('a')].find((anchor) => anchor.textContent === 'Search test relative link');
    assert.ok(link);
    assert.equal(link.getAttribute('href'), base.target);
    assert.doesNotMatch(result.markdown ?? '', /search-test-hidden-instruction|search-test-ad-content/);
    assert.deepEqual(page, original);
  });
}

test('Given the documented no-results derivative of the captured page, when the real engine and cleaners run, then classification stays separate from the cleaned page content', async () => {
  const captured = new CapturedBraveResults();
  const page = {
    ...captured.page,
    html: readFileSync(new URL('test/support/fixtures/search-engine/brave-no-results-derived.html', repositoryRoot), 'utf8'),
  };
  const original = { ...page };
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => page });
  const document = await engine.search(captured.metadata.query, new AbortController().signal);
  assert.equal(document.kind, 'no_results');
  assert.equal(document.page, page);
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(''),
    new PromptInjectionRemoverSanitizer(),
    new BraveHTTPResultCleanup(),
    new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true }),
  ]);

  const result = await pipeline.process(document.page);

  assert.equal(result.scanWithholding, undefined);
  assert.equal(typeof result.markdown, 'string');
  assert.doesNotMatch(result.markdown ?? '', /Lightpanda \| The headless browser/);
  assert.deepEqual(page, original);
});
