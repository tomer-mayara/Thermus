import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { openSearchSite } from '../../support/in-process/mcp-search-site.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { HiddenHtmlScanner } from '../../../src/pipelines/html-processing/prompt-injection-remover/hidden-html-scanner.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';
import { assertCleanSearchResults } from '../../support/dsl/search-results.ts';

const reason = 'Find sources for this task';
const boundedSearchSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', minLength: 1, maxLength: 512, pattern: '\\S' },
    reason: { type: 'string', minLength: 1, maxLength: 2_000, pattern: '\\S' },
  },
  required: ['query', 'reason'],
  additionalProperties: false,
};

test('Given an authorized MCP client, when it discovers tools, then search and page fetch are available with bounded search arguments', async (t) => {
  const { client } = await openSearchSite(t, '2026-07-28', 'self-hosted');
  const { tools } = await client.listTools();

  assert.ok(tools.some(({ name }) => name === 'getURLAsMarkdown'));
  const search = tools.find(({ name }) => name === 'search');
  assert.ok(search, 'The search tool must be available');
  assert.partialDeepStrictEqual(search.inputSchema, boundedSearchSchema);
});

test('Given an authorized MCP client, when search arguments are invalid, then each call returns only the fixed invalid-arguments error', async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const { client, stages, completions } = await openSearchSite(t, '2026-07-28', 'self-hosted');
  const invalidArguments = [
    { reason },
    { query: '', reason },
    { query: ' \n\t', reason },
    { query: 'x'.repeat(513), reason },
    { query: '\uD800', reason },
    { query: 'sources' },
    { query: 'sources', reason: '' },
    { query: 'sources', reason: ' \n\t' },
    { query: 'sources', reason: 'x'.repeat(2_001) },
    { query: 'sources', reason, extra: 'untrusted' },
  ];

  for (const argumentsValue of invalidArguments) {
    const result = await client.callTool({ name: 'search', arguments: argumentsValue });
    assert.deepEqual(result.content, [{ type: 'text', text: 'Invalid tool arguments' }]);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  }
  assert.equal(renderer.launches.length, 0);
  assert.equal(renderer.lookups.length, 0);
  assert.deepEqual(stages(), []);
  assert.equal(completions().length, invalidArguments.length);
  assert.ok(completions().every((record) => record.status === 'invalid_arguments'));
});


const searchDescription = 'Search the web with a text query and return cleaned results as Markdown. Use this tool for web searches; search engines may block generic page-fetch requests. Use getURLAsMarkdown to read a result page. Give the reason the agent needs the search.';
const fetchDescription = 'Fetch a known web page URL as Markdown. For web searches, use search instead of fetching a search engine results URL. Give the reason the agent needs the page.';
const searchUrl = 'https://search.brave.com/search?q=private-acceptance-query';
const fixture = (name: string) => readFileSync(new URL(`test/support/fixtures/search-engine/${name}`, repositoryRoot), 'utf8');

test('Given a results page whose web cards are all hidden, when an authorized client searches, then processing fails without releasing chrome or claiming no results', async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const original = fixture('brave-results.html');
  const html = original.replace('</head>', '<style>.snippet[data-type="web"] { display: none; }</style></head>');
  assert.notEqual(html, original);
  renderer.serve(searchUrl, { finalUrl: searchUrl, html });
  const site = await openSearchSite(t, '2026-07-28', 'self-hosted');

  const result = await site.client.callTool({ name: 'search', arguments: { query: 'private-acceptance-query', reason } });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.deepEqual(result.content, [{ type: 'text', text: 'Search processing failed' }]);
  assert.equal(renderer.launches.length, 1);
  assert.equal(site.completions().length, 1);
  assert.equal(site.completions()[0].status, 'processing_failed');
  assert.deepEqual(site.stages().map(({ stepId, outcome }) => ({ stepId, outcome })), [
    { stepId: 'search.outgoing.observe_request', outcome: 'allowed' },
    { stepId: 'search.incoming.process_html', outcome: 'allowed' },
  ]);
  assert.doesNotMatch(site.records.join('\n'), /private-acceptance-query|Lightpanda \| The headless browser/);
});

for (const edition of ['hosted', 'self-hosted'] as const) {
  test(`Given ${edition} and the full video-result page, when an authorized client searches, then only numbered organic results with associated descriptions reach the client`, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    const metadata = JSON.parse(fixture('brave-results-video.json')) as { query: string; requestedUrl: string; finalUrl: string };
    renderer.serve(metadata.requestedUrl, { finalUrl: metadata.finalUrl, html: fixture('brave-results-video.html') });
    const site = await openSearchSite(t, '2026-07-28', edition);

    const result = await site.client.callTool({ name: 'search', arguments: { query: metadata.query, reason } });

    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(result.content.length, 1);
    const content = result.content[0];
    assert.equal(content.type, 'text');
    if (content.type !== 'text') throw new Error('Expected Markdown');
    const expected = JSON.parse(fixture('brave-results-video-expected.json')) as { title: string; url: string; snippet: string }[];
    assert.equal(expected.length, 18);
    assertCleanSearchResults(content.text, expected);
    assert.equal(renderer.launches.length, 1);
    assert.equal(site.completions().length, 1);
    assert.equal(site.completions()[0].status, 'success');
    assert.deepEqual(site.stages().map(({ stepId, outcome }) => ({ stepId, outcome })), [
      { stepId: 'search.outgoing.observe_request', outcome: 'allowed' },
      { stepId: 'search.incoming.process_html', outcome: 'allowed' },
    ]);
  });
}

for (const edition of ['hosted', 'self-hosted'] as const) {
  test(`Given ${edition} and the full inline question page, when an authorized client searches, then all organic results and question descriptions reach the client without answer widgets`, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    const metadata = JSON.parse(fixture('brave-results-inline-qa.json')) as { query: string; requestedUrl: string; finalUrl: string };
    renderer.serve(metadata.requestedUrl, { finalUrl: metadata.finalUrl, html: fixture('brave-results-inline-qa.html') });
    const site = await openSearchSite(t, '2026-07-28', edition);

    const result = await site.client.callTool({ name: 'search', arguments: { query: metadata.query, reason } });

    assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(result.content.length, 1);
    const content = result.content[0];
    assert.equal(content.type, 'text');
    if (content.type !== 'text') throw new Error('Expected Markdown');
    const expected = JSON.parse(fixture('brave-results-inline-qa-expected.json')) as { title: string; url: string; snippet: string }[];
    assert.equal(expected.length, 20);
    assertCleanSearchResults(content.text, expected);
    assert.doesNotMatch(content.text, /Top answer|1 of 2|2 of 2|Also you should be looking for laptops with support for thunderbolt 5|As someone who's recently been on a similar search/);
    assert.equal(renderer.launches.length, 1);
    const [completion] = site.completions();
    assert.equal(site.completions().length, 1);
    assert.equal(completion.status, 'success');
    assert.deepEqual(site.stages().map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
      { operationId: completion.operationId, stepId: 'search.outgoing.observe_request', outcome: 'allowed' },
      { operationId: completion.operationId, stepId: 'search.incoming.process_html', outcome: 'allowed' },
    ]);
    assert.doesNotMatch(site.records.join('\n'), /consumer laptop|Find sources|reddit\.com|GamingLaptops/);
  });
}

for (const edition of ['hosted', 'self-hosted'] as const) {
  for (const era of mcpProtocolEras) {
    test(`Given ${edition} in ${era}, when an authorized client discovers and searches the captured Brave page, then guidance and all cleaned results reach the client with private correlated records`, async (t) => {
      const renderer = RendererProcessDouble.install(t);
      renderer.serve(searchUrl, { finalUrl: searchUrl, html: fixture('brave-results.html') });
      const site = await openSearchSite(t, era, edition);
      const { tools } = await site.client.listTools();
      const searchTool = tools.find((tool) => tool.name === 'search');
      assert.equal(searchTool?.description, searchDescription);
      assert.partialDeepStrictEqual(searchTool?.inputSchema, boundedSearchSchema);
      assert.equal(tools.find((tool) => tool.name === 'getURLAsMarkdown')?.description, fetchDescription);
      assert.ok(tools.every((tool) => !Object.hasOwn(tool, 'details')));
      const result = await site.client.callTool({ name: 'search', arguments: { query: 'private-acceptance-query', reason: 'private-acceptance-reason' } });
      assert.notEqual(result.isError, true);
      assert.equal(result.structuredContent, undefined);
      assert.equal(result.content.length, 1);
      const content = result.content[0];
      assert.equal(content.type, 'text');
      if (content.type !== 'text') throw new Error('Expected Markdown');
      const expected = JSON.parse(fixture('brave-results-expected.json')) as { title: string; url: string; snippet: string }[];
      assert.equal(expected.length, 18);
      assertCleanSearchResults(content.text, expected);
      assert.equal(renderer.launches.length, 1);
      const [completion] = site.completions();
      assert.equal(site.completions().length, 1);
      assert.equal(completion.tool, 'search');
      assert.equal(completion.status, 'success');
      assert.deepEqual(Object.keys(completion).sort(), ['event', 'operationId', 'authority', 'subject', 'tenantId', 'tool', 'status', 'durationMs'].sort());
      assert.equal(site.stages().length, 2);
      assert.deepEqual(site.stages().map((stage) => stage.stepId), ['search.outgoing.observe_request', 'search.incoming.process_html']);
      assert.ok(site.stages().every((stage) => stage.operationId === completion.operationId && stage.outcome === 'allowed'));
      assert.doesNotMatch(site.records.join('\n'), /private-acceptance-query|private-acceptance-reason|Lightpanda \| The headless browser/);
    });
  }
  test(`Given ${edition} with an explicit no-results Brave page, when the client searches, then only the fixed no-results text is released`, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(searchUrl, { finalUrl: searchUrl, html: fixture('brave-no-results-derived.html') });
    const site = await openSearchSite(t, '2026-07-28', edition);
    const result = await site.client.callTool({ name: 'search', arguments: { query: 'private-acceptance-query', reason } });
    assert.deepEqual(result.content, [{ type: 'text', text: 'No search results.' }]);
    assert.notEqual(result.isError, true);
    assert.equal(site.stages().length, 2);
  });
}

for (const edition of ['hosted', 'self-hosted'] as const) {
  for (const [conflict, content] of [
    ['a duplicate results section', '<section id="mixed-main"><div class="snippet" data-type="web"><div class="result-content"><a class="l1" href="https://private-result.example"><div class="title search-snippet-title">private-conflicting-title</div></a><div class="generic-snippet"><div class="content">private-conflicting-description</div></div></div></div></section>'],
    ['a second known banner', '<section id="bad-results-info-banner">private-conflicting-banner</section>'],
    ['a Brave result card', '<div class="snippet" data-type="web"><div class="result-content"><a class="l1" href="https://private-result.example"><div class="title search-snippet-title">private-conflicting-title</div></a><div class="generic-snippet"><div class="content">private-conflicting-description</div></div></div></div>'],
  ] as const) {
    test(`Given ${edition} with supported no-results and ${conflict} outside the search main, when a client searches, then it fails before incoming with one provider call and private records`, async (t) => {
      const renderer = RendererProcessDouble.install(t);
      const original = fixture('brave-no-results-derived.html');
      const html = original.replace('</body>', `${content}</body>`);
      assert.notEqual(html, original);
      renderer.serve(searchUrl, { finalUrl: searchUrl, html });
      const site = await openSearchSite(t, '2026-07-28', edition);

      const result = await site.client.callTool({ name: 'search', arguments: { query: 'private-acceptance-query', reason: 'private-acceptance-reason' } });

      assert.deepEqual(result.content, [{ type: 'text', text: 'Search failed' }]);
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent, undefined);
      assert.equal(renderer.launches.length, 1);
      assert.equal(site.completions().length, 1);
      const [completion] = site.completions();
      assert.equal(completion.tool, 'search');
      assert.equal(completion.status, 'search_failed');
      assert.deepEqual(Object.keys(completion).sort(), ['event', 'operationId', 'authority', 'subject', 'tenantId', 'tool', 'status', 'durationMs'].sort());
      assert.deepEqual(site.stages().map(({ operationId, stepId, outcome }) => ({ operationId, stepId, outcome })), [
        { operationId: completion.operationId, stepId: 'search.outgoing.observe_request', outcome: 'allowed' },
      ]);
      assert.doesNotMatch(site.records.join('\n'), /private-acceptance-query|private-acceptance-reason|private-conflicting|private-result\.example|lightpanda browser/);
    });
  }
  test(`Given ${edition} with an incoming scan failure, when a client searches, then the public result withholds all content and logs one safe completion`, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    renderer.serve(searchUrl, { finalUrl: searchUrl, html: fixture('brave-results.html') });
    t.mock.method(HiddenHtmlScanner, 'scan', () => { throw new Error('private-scan-failure'); });
    const site = await openSearchSite(t, '2026-07-28', edition);
    const result = await site.client.callTool({ name: 'search', arguments: { query: 'private-acceptance-query', reason } });
    assert.deepEqual(result.content, [{ type: 'text', text: 'Search content withheld' }]);
    assert.equal(renderer.launches.length, 1);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
    assert.equal(site.completions().length, 1);
    assert.equal(site.completions()[0].status, 'withheld');
    assert.equal(site.stages().length, 2);
    assert.doesNotMatch(site.records.join('\n'), /private-scan-failure|private-acceptance-query|Lightpanda \|/);
  });
}

for (const refusal of ['authentication', 'access', 'origin', 'body', 'envelope'] as const) {
  test(`Given a search call refused for ${refusal}, when the public HTTP boundary rejects it, then no renderer or operation records are created`, async (t) => {
    const renderer = RendererProcessDouble.install(t);
    const site = await openSearchSite(t, '2026-07-28', 'hosted');
    if (refusal === 'access') t.mock.method(site.provider, 'resolve', async () => ({ allowed: false as const, reason: 'permission-required' as const }));
    const request = mcpRequest({ url: site.url.href, method: 'tools/call', token: refusal === 'authentication' ? undefined : 'token',
      headers: refusal === 'origin' ? { Origin: 'https://attacker.example' } : {},
      params: { name: 'search', arguments: { query: 'private-refused-query', reason } } });
    const invalid = refusal === 'body' || refusal === 'envelope'
      ? new Request(request.url, { method: 'POST', headers: request.headers, body: refusal === 'body' ? '{' : JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: 'invalid' }) })
      : request;
    const response = await fetch(invalid);
    const body = await response.text();
    assert.ok(response.status >= 400 || body.includes('"error"'), `Expected refusal: ${response.status} ${body}`);
    assert.deepEqual(site.completions(), []);
    assert.deepEqual(site.stages(), []);
    assert.equal(renderer.launches.length, 0);
    assert.equal(renderer.lookups.length, 0);
  });
}
