import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { permitIPv4Fixture, startFixture } from '../support/network-fixture.ts';

const html = '<html><head><title>Redirect fixture</title></head><body><main><p>Related pages: <a href="child">Child</a> and <a href="/root">Root</a>.</p></main></body></html>';

test('returns direct-page metadata and preserves rendered content', { timeout: 65_000 }, async (t) => {
  permitIPv4Fixture(t);
  const fixture = await startFixture(t, (_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  });
  const url = `${fixture.hostnameOrigin}/directory/page`;

  const page = await new WebsiteFetcherLightpanda().fetchURL(url);

  assert.equal(page.requestedUrl, url);
  assert.equal(page.finalUrl, url);
  assert.match(page.html, /Redirect fixture/);
  const result = await new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]).process(page);
  assert.ok(result.markdown?.includes(`[Child](${fixture.hostnameOrigin}/directory/child)`));
});

test('uses the final host and path after a local redirect chain', { timeout: 65_000 }, async (t) => {
  permitIPv4Fixture(t);
  const visited: string[] = [];
  const destination = await startFixture(t, (request, response) => {
    visited.push(`destination${request.url}`);
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  });
  const source = await startFixture(t, (request, response) => {
    visited.push(`source${request.url}`);
    response.writeHead(302, { Location: request.url === '/redirect' ? '/next' : `${destination.origin}/directory/page` });
    response.end();
  });
  const requestedUrl = `${source.hostnameOrigin}/redirect`;
  const finalUrl = `${destination.origin}/directory/page`;

  const page = await new WebsiteFetcherLightpanda().fetchURL(requestedUrl);

  assert.equal(page.requestedUrl, requestedUrl);
  assert.equal(page.finalUrl, finalUrl);
  assert.deepEqual(visited, ['source/redirect', 'source/next', 'destination/directory/page']);
  const result = await new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]).process(page);
  assert.ok(result.markdown?.includes(`[Child](${destination.origin}/directory/child)`));
  assert.ok(result.markdown?.includes(`[Root](${destination.origin}/root)`));
  assert.equal(result.requestedUrl, requestedUrl);
  assert.equal(result.finalUrl, finalUrl);
});
