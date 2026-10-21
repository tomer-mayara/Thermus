// The explicit pinned renderer gate selects this file; ordinary *.test.js globs do not.
import assert from 'node:assert/strict';
import { before, describe, test, type TestContext } from 'node:test';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetcher, WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { permitIPv4Fixture, startFixture } from '../../support/doubles/website-fetcher/network-fixture.ts';
import { openSearchSite } from '../../support/in-process/mcp-search-site.ts';
import { pinnedRenderer } from '../../support/processes/pinned-renderer.ts';

const query = 'private runtime query 雪 & sources';
const reason = 'Find runtime sources for this task';
const canonicalUrl = `https://search.brave.com/search?${new URLSearchParams({ q: query })}`;
const expected = [
  { title: 'Rendered runtime guide', url: 'https://runtime.example/guide', snippet: 'JavaScript created this first result with its complete safe description.' },
  { title: 'Canonical relative destination', url: 'https://search.brave.com/guides/rendering', snippet: 'This second result resolves its relative destination against the canonical search page.' },
  { title: 'Unicode runtime source 雪', url: 'https://runtime.example/unicode?language=雪', snippet: 'The final source keeps Unicode and the original result order.' },
];

const resultsMarkup = expected.map((entry, index) => `<div class="snippet" data-type="web"><div class="result-content">`
  + `<a class="l1" href="${index === 1 ? '/guides/rendering' : entry.url}"><div class="title search-snippet-title">${entry.title}</div></a>`
  + `<div class="generic-snippet"><div class="content">${entry.snippet}</div></div></div></div>`).join('');
const noResultsMarkup = '<div class="fallback-snippet"><div id="bad-results-info-banner">'
  + '<span>Not many great matches came back for your search: <span>runtime absent sources</span></span>'
  + '<ul><li>Try more general keywords</li><li>Try fewer keywords</li></ul></div></div>';
const resultsScript = `document.getElementById('mixed-main').innerHTML = ${JSON.stringify(resultsMarkup)};
document.querySelector('.content').insertAdjacentHTML('beforeend', '<div hidden>private hidden runtime instruction</div>'
  + '<p class="runtime-hidden">private CSS hidden instruction</p><a href="javascript:alert(1)">Unsafe destination</a>');`;
const withheldScript = `${resultsScript}
let nested = '<span hidden>private withheld runtime instruction</span>';
for (let pass = 1; pass < 8; pass += 1) nested = '<' + nested + 'span hidden>private withheld runtime instruction</span>';
const payload = document.createElement('script');
payload.type = 'text/plain';
payload.textContent = '<' + '/script>' + nested;
document.querySelector('.content').append(payload);`;
const fullPage = '<!DOCTYPE html><html><head><title>Pinned search runtime</title>'
  + '<meta name="runtime-document" content="whole-document-head"><style>.runtime-hidden { display: none; }</style></head>'
  + '<body><main id="search-page"><h1>Runtime search sources</h1><section id="mixed-main">'
  + '<p>private unrendered placeholder</p></section></main><footer data-runtime="whole-document-footer">Runtime footer</footer>'
  + '<script src="/runtime.js"></script></body></html>';

// Only transport changes: the real renderer reads a local page, then the real Brave classifier receives canonical metadata.
class LocalBraveTransport implements WebsiteFetcher {
  readonly requests: string[] = [];
  readonly pages: WebsiteFetchResult[] = [];

  constructor(private readonly render: WebsiteFetcher['fetchURL'], private readonly fixtureUrl: string) {}

  async fetchURL(url: string, signal?: AbortSignal): Promise<WebsiteFetchResult> {
    assert.equal(url, canonicalUrl);
    this.requests.push(url);
    const rendered = await this.render(this.fixtureUrl, signal);
    assert.equal(rendered.requestedUrl, this.fixtureUrl);
    assert.equal(rendered.finalUrl, this.fixtureUrl);
    const page = { ...rendered, requestedUrl: url, finalUrl: url };
    this.pages.push(page);
    return page;
  }
}

async function localSearch(t: TestContext, executable: string, script: string) {
  permitIPv4Fixture(t);
  const fixture = await startFixture(t, (request, response) => {
    if (request.url === '/search') {
      response.setHeader('Content-Type', 'text/html');
      response.end(fullPage);
    } else if (request.url === '/runtime.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(script);
    } else {
      response.writeHead(404);
      response.end('Missing runtime fixture');
    }
  });
  const renderer = new WebsiteFetcherLightpanda(executable);
  const transport = new LocalBraveTransport(renderer.fetchURL.bind(renderer), `${fixture.hostnameOrigin}/search`);
  t.mock.method(WebsiteFetcherLightpanda.prototype, 'fetchURL', transport.fetchURL.bind(transport));
  const processing = t.mock.method(HtmlToMarkdownPipeline.prototype, 'process');
  const site = await openSearchSite(t, '2026-07-28', 'self-hosted');
  return { ...site, fixture, transport, processing };
}

describe('search with pinned Lightpanda, canonical Brave metadata, and the real cleaners', () => {
  let executable = '';

  before(async () => { executable = await pinnedRenderer(); });

  test('Given a complete local page that creates Brave results with JavaScript, when the MCP client searches, then safe titles, destinations, snippets, and order reach the tool result', { timeout: 120_000 }, async (t) => {
    const site = await localSearch(t, executable, resultsScript);

    const result = await site.client.callTool({ name: 'search', arguments: { query, reason } });

    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(result.content.length, 1);
    const content = result.content[0];
    assert.equal(content.type, 'text');
    if (content.type !== 'text') throw new Error('Expected Markdown');
    const document = parseHTML(`<html><body>${micromark(content.text)}</body></html>`).document;
    const links = [...document.querySelectorAll('a[href]')];
    const text = document.body.textContent.replace(/\s+/g, ' ').trim();
    let previousLink = -1;
    let previousSnippet = -1;
    for (const entry of expected) {
      const linkIndex = links.findIndex((link, index) => index > previousLink
        && new URL(link.getAttribute('href') ?? '', canonicalUrl).href === new URL(entry.url).href
        && link.textContent.replace(/\s+/g, ' ').trim() === entry.title);
      assert.ok(linkIndex > previousLink, `Missing or reordered result: ${entry.title}`);
      const titleIndex = text.indexOf(entry.title, previousSnippet + 1);
      assert.ok(titleIndex > previousSnippet, `Missing or reordered title: ${entry.title}`);
      const snippetIndex = text.indexOf(entry.snippet, titleIndex + entry.title.length);
      assert.ok(snippetIndex >= 0, `Missing snippet: ${entry.title}`);
      previousLink = linkIndex;
      previousSnippet = snippetIndex;
    }
    assert.doesNotMatch(content.text, /private hidden|private CSS|private unrendered|javascript:|localhost/);
    assert.deepEqual(site.fixture.requests, ['/search', '/runtime.js']);
    assert.deepEqual(site.transport.requests, [canonicalUrl]);
    assert.equal(site.processing.mock.calls.length, 1);
    const [page] = site.processing.mock.calls[0].arguments;
    assert.equal(page, site.transport.pages[0]);
    assert.equal(page.requestedUrl, canonicalUrl);
    assert.equal(page.finalUrl, canonicalUrl);
    assert.match(page.html, /<head[\s>]/);
    assert.match(page.html, /<style[\s>]/);
    assert.match(page.html, /whole-document-head/);
    assert.match(page.html, /whole-document-footer/);
    assert.match(page.html, /private hidden runtime instruction/);
    assert.deepEqual(site.completions().map(({ status }) => status), ['success']);
    assert.deepEqual(site.stages().map(({ stepId, outcome }) => ({ stepId, outcome })), [
      { stepId: 'search.outgoing.observe_request', outcome: 'allowed' },
      { stepId: 'search.incoming.process_html', outcome: 'allowed' },
    ]);
    assert.doesNotMatch(site.records.join('\n'), /private runtime query|Find runtime sources|Rendered runtime guide|whole-document/);
  });

  for (const scenario of [
    { given: 'JavaScript creates an explicit no-results page', script: `document.getElementById('mixed-main').innerHTML = ${JSON.stringify(noResultsMarkup)};`, text: 'No search results.', status: 'success', incoming: 1 },
    { given: 'the rendered results contain HTML that the scanner withholds', script: withheldScript, text: 'Search content withheld', status: 'withheld', incoming: 1 },
    { given: 'the rendered page has an unsupported search structure', script: "document.getElementById('mixed-main').innerHTML = '<p>private unsupported response</p>';", text: 'Search failed', status: 'search_failed', incoming: 0 },
  ]) {
    test(`Given ${scenario.given}, when the MCP client searches with the pinned renderer, then it receives only ${scenario.text}`, { timeout: 120_000 }, async (t) => {
      const site = await localSearch(t, executable, scenario.script);

      const result = await site.client.callTool({ name: 'search', arguments: { query, reason } });

      assert.deepEqual(result.content, [{ type: 'text', text: scenario.text }]);
      assert.equal(result.isError === true, scenario.status !== 'success');
      assert.equal(result.structuredContent, undefined);
      assert.deepEqual(site.fixture.requests, ['/search', '/runtime.js']);
      assert.deepEqual(site.transport.requests, [canonicalUrl]);
      assert.equal(site.processing.mock.calls.length, scenario.incoming);
      assert.deepEqual(site.completions().map(({ status }) => status), [scenario.status]);
      assert.equal(site.stages().length, 1 + scenario.incoming);
      assert.doesNotMatch(site.records.join('\n'), /private |runtime absent sources|Rendered runtime guide|whole-document/);
      assert.ok(site.records.every((record) => JSON.parse(record).event !== 'renderer.fetch.failed'));
    });
  }
});
