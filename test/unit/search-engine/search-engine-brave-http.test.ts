import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SearchEngineBraveHttp } from '../../../src/search-engine/search-engine-brave-http.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';
import { repositoryRoot } from '../../support/processes/module-paths.ts';

const capturedPage: WebsiteFetchResult = {
  requestedUrl: 'https://search.brave.com/search?q=lightpanda+browser',
  finalUrl: 'https://search.brave.com/search?q=lightpanda+browser',
  html: readFileSync(new URL('test/support/fixtures/search-engine/brave-results.html', repositoryRoot), 'utf8'),
};

const noResultsPage: WebsiteFetchResult = {
  ...capturedPage,
  html: readFileSync(new URL('test/support/fixtures/search-engine/brave-no-results-derived.html', repositoryRoot), 'utf8'),
};

const supportedResults = '<html><head></head><body><main id="search-page"><section id="mixed-main"><div class="snippet" data-type="web"><div class="result-content"><a class="l1" href="https://example.com"><div class="title search-snippet-title">Title</div></a><div class="generic-snippet"><div class="content">Snippet</div></div></div></div></section></main></body></html>';

const unknownPage: WebsiteFetchResult = {
  requestedUrl: 'https://search.brave.com/search?q=sources',
  finalUrl: 'https://search.brave.com/search?q=sources',
  html: '<html><body><main>Unsupported page</main></body></html>',
};

test('Given the captured Brave results page, when the engine searches, then it returns results with the same original full page', async () => {
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => capturedPage });

  const result = await engine.search('lightpanda browser', new AbortController().signal);

  assert.equal(result.kind, 'results');
  assert.equal(result.page, capturedPage);
});

test('Given the controlled no-results page derived from the provider template, when classified, then it returns no-results with the original full page', async () => {
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => noResultsPage });

  const result = await engine.search('lightpanda browser', new AbortController().signal);

  assert.equal(result.kind, 'no_results');
  assert.equal(result.page, noResultsPage);
});

for (const [shape, html] of [
  ['an error header', noResultsPage.html.replace('Not many great matches came back for your search:', 'Sorry, something went wrong')],
  ['a query-too-long header', noResultsPage.html.replace('Not many great matches came back for your search:', 'Your query is too long')],
  ['an unknown localized header', noResultsPage.html.replace('Not many great matches came back for your search:', 'Aucun résultat')],
  ['a missing fallback parent', noResultsPage.html.replaceAll('fallback-snippet', 'other-fallback')],
  ['a missing query span', noResultsPage.html.replace('<span class="desktop-default-semibold t-primary">"lightpanda browser"</span>', '')],
  ['a blank query span', noResultsPage.html.replace('<span class="desktop-default-semibold t-primary">"lightpanda browser"</span>', '<span> </span>')],
  ['a missing header', noResultsPage.html.replace('<span>Not many great matches came back for your search: <span class="desktop-default-semibold t-primary">"lightpanda browser"</span></span>', '')],
  ['conflicting headers', noResultsPage.html.replace('<span>Not many great matches came back for your search:', '<span>Unsupported error</span><span>Not many great matches came back for your search:')],
  ['a missing search tip', noResultsPage.html.replace('<li>Try fewer keywords</li>', '')],
  ['an unsupported search tip', noResultsPage.html.replace('Try fewer keywords', 'Try again later')],
  ['unrecognized result content', noResultsPage.html.replace('</ul></section></div></section>', '</ul></section></div><article><a href="https://example.com">Result</a></article></section>')],
  ['meaningful sibling text', noResultsPage.html.replace('</ul></section></div></section>', '</ul></section></div>Unrecognized result</section>')],
  ['extra fallback content', noResultsPage.html.replace('</ul></section></div></section>', '</ul></section><article>Unrecognized result</article></div></section>')],
  ['unknown banner content', noResultsPage.html.replace('</ul></section></div></section>', '</ul><article>Unrecognized result</article></section></div></section>')],
  ['a nested fallback wrapper', noResultsPage.html.replace('<div class="fallback-snippet svelte-6dkl6q">', '<div class="unknown-wrapper"><div class="fallback-snippet svelte-6dkl6q">').replace('</ul></section></div></section>', '</ul></section></div></div></section>')],
  ['an extra result snippet', noResultsPage.html.replace('</ul></section></div></section>', '</ul></section><div class="snippet">Other result</div></div></section>')],
  ['a result link elsewhere', noResultsPage.html.replace('id="floating-infobox-anchor"></div>', 'id="floating-infobox-anchor"><a class="l1" href="https://example.com">Other result</a></div>')],
  ['a non-web result type', noResultsPage.html.replace('id="floating-infobox-anchor"></div>', 'id="floating-infobox-anchor"><div data-type="images">Image result</div></div>')],
  ['multiple banners', noResultsPage.html.replace('</ul></section>', '</ul></section><section id="bad-results-info-banner"></section>')],
] as const) {
  test(`Given the no-results template with ${shape}, when classified, then it fails without claiming absence`, async () => {
    assert.notEqual(html, noResultsPage.html);
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...noResultsPage, html }) });

    await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
  });
}

test('Given the supported no-results shape with comments and whitespace, when classified, then navigation outside the results section does not imply results', async () => {
  const html = noResultsPage.html.replace('id="mixed-main" class="svelte-e12qt1">', 'id="mixed-main" class="svelte-e12qt1"> \n<!-- section comment -->')
    .replace('<div class="fallback-snippet svelte-6dkl6q">', '<div class="fallback-snippet svelte-6dkl6q"> \n<!-- fallback comment -->')
    .replace('id="floating-infobox-anchor"></div>', 'id="floating-infobox-anchor"><a href="https://example.com">Navigation</a></div>');
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...noResultsPage, html }) });

  const result = await engine.search('sources', new AbortController().signal);

  assert.equal(result.kind, 'no_results');
});

test('Given actual results and a bad-results banner together, when classified, then the ambiguous page fails', async () => {
  const html = capturedPage.html.replace('id="mixed-main" class="svelte-e12qt1">', 'id="mixed-main" class="svelte-e12qt1"><section id="bad-results-info-banner"></section>');
  assert.notEqual(html, capturedPage.html);
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

  await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
});

for (const [shape, html] of [
  ['search roots', capturedPage.html.replace('</body>', '<main id="search-page"><p>Unsupported</p></main></body>')],
  ['results sections', capturedPage.html.replace('id="floating-infobox-anchor"></div>', 'id="floating-infobox-anchor"></div><section id="mixed-main"><p>Unsupported</p></section>')],
] as const) {
  test(`Given duplicate ${shape}, when classified, then the ambiguous page is refused`, async () => {
    assert.notEqual(html, capturedPage.html);
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

    await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
  });
}

test('Given supported results with challenge and no-results phrases in query, script, and content, when classified, then structural results still win', async () => {
  const phrases = 'No results found. Verify you are human. CAPTCHA.';
  const page = {
    ...capturedPage,
    html: capturedPage.html.replaceAll('Lightpanda', phrases).replace('</head>', `<script>${JSON.stringify(phrases)}</script></head>`),
  };
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => page });

  const result = await engine.search(phrases, new AbortController().signal);

  assert.equal(result.kind, 'results');
  assert.equal(result.page, page);
});

for (const [part, html] of [
  ['search root', capturedPage.html.replace('id="search-page"', 'id="other-page"')],
  ['results section', capturedPage.html.replace('id="mixed-main"', 'id="other-main"')],
  ['web result type', capturedPage.html.replaceAll('data-type="web"', 'data-type="other"')],
  ['result title', capturedPage.html.replaceAll('search-snippet-title', 'other-title')],
  ['result links', capturedPage.html.replaceAll(/href="[^"]*"/g, '')],
  ['snippet content', capturedPage.html.replaceAll('generic-snippet', 'other-snippet')],
] as const) {
  test(`Given captured results without the required ${part}, when classified, then the page is refused`, async () => {
    assert.notEqual(html, capturedPage.html);
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

    await assert.rejects(engine.search('lightpanda browser', new AbortController().signal), { message: 'Search failed' });
  });
}

test('Given query delimiters and Unicode, when Brave is requested, then the query stays in one encoded parameter at the fixed endpoint', async () => {
  const query = ' café 😀 &q=other#fragment?x=1 https://elsewhere.example/ ';
  const signal = new AbortController().signal;
  const calls: { url: string; signal: AbortSignal | undefined }[] = [];
  const engine = new SearchEngineBraveHttp({ fetchURL: async (url, receivedSignal) => {
    calls.push({ url, signal: receivedSignal });
    return capturedPage;
  } });

  await engine.search(query, signal);

  assert.equal(calls.length, 1);
  const requested = new URL(calls[0].url);
  assert.equal(requested.origin, 'https://search.brave.com');
  assert.equal(requested.pathname, '/search');
  assert.deepEqual([...requested.searchParams], [['q', query]]);
  assert.equal(requested.hash, '');
  assert.equal(calls[0].signal, signal);
});

for (const finalUrl of [
  'not a URL',
  'http://search.brave.com/search?q=sources',
  'https://other.example/search?q=sources',
  'https://search.brave.com:8443/search?q=sources',
  'https://search.brave.com/other?q=sources',
  'https://search.brave.com/search/?q=sources',
  'https://user:secret@search.brave.com/search?q=sources',
  'https://:secret@search.brave.com/search?q=sources',
]) {
  test(`Given the unsupported final URL ${finalUrl}, when Brave returns it, then the engine fails with fixed safe text`, async () => {
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, finalUrl }) });

    await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
  });
}

test('Given a supported final URL with extra provider query parameters, when classified, then the results are accepted', async () => {
  const page = { ...capturedPage, finalUrl: 'https://search.brave.com/search?q=lightpanda+browser&conversation=example&spellcheck=0' };
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => page });

  const result = await engine.search('lightpanda browser', new AbortController().signal);

  assert.equal(result.kind, 'results');
  assert.equal(result.page, page);
});

test('Given supported results at exactly 10 MiB of UTF-8 HTML, when classified, then the byte limit permits the page', async () => {
  const padding = 10 * 1024 * 1024 - Buffer.byteLength(supportedResults, 'utf8') - 7;
  const page = { ...capturedPage, html: supportedResults + '<!--' + 'x'.repeat(padding) + '-->' };
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => page });

  const result = await engine.search('sources', new AbortController().signal);

  assert.equal(result.kind, 'results');
  assert.equal(result.page, page);
});

test('Given supported results above 10 MiB in UTF-8 but fewer characters, when classified, then the page is refused', async () => {
  const padding = Math.floor((10 * 1024 * 1024 - Buffer.byteLength(supportedResults, 'utf8') - 7) / 2) + 1;
  const html = supportedResults + '<!--' + 'é'.repeat(padding) + '-->';
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

  await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
});

for (const [depth, wrappers] of [[256, 248], [257, 249]] as const) {
  test(`Given supported results at element depth ${depth}, when classified, then the depth limit is enforced`, async () => {
    const html = supportedResults.replace('<main', '<div>'.repeat(wrappers) + '<main').replace('</main>', '</main>' + '</div>'.repeat(wrappers));
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });
    const result = engine.search('sources', new AbortController().signal);

    if (depth === 256) assert.equal((await result).kind, 'results');
    else await assert.rejects(result, { message: 'Search failed' });
  });
}

for (const [part, html] of [
  ['blank title', supportedResults.replace('>Title</div>', '> \n </div>')],
  ['blank destination', supportedResults.replace('href="https://example.com"', 'href=" "')],
  ['blank snippet', supportedResults.replace('>Snippet</div>', '> \n </div>')],
  ['one malformed web result', capturedPage.html.replace('class="title search-snippet-title', 'class="title missing-title')],
] as const) {
  test(`Given supported structure with ${part}, when classified, then incomplete results are refused`, async () => {
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

    await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
  });
}

test('Given an unknown page with no-results and challenge phrases, when it is classified, then it fails without claiming absence', async () => {
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({
    ...unknownPage,
    html: '<main>No results found. Verify you are human. CAPTCHA.</main>',
  }) });

  await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
});

test('Given a controlled challenge form in the search shell, when classified, then it fails instead of returning results or absence', async () => {
  const html = '<html><body><main id="search-page"><section id="mixed-main"><form action="/challenge"><input name="captcha"><button>Verify you are human</button></form></section></main></body></html>';
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => ({ ...capturedPage, html }) });

  await assert.rejects(engine.search('sources', new AbortController().signal), { message: 'Search failed' });
});

test('Given a renderer failure, when fetching rejects, then the same failure reaches the caller without retry', async () => {
  const failure = new Error('private renderer diagnostic');
  let calls = 0;
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => {
    calls += 1;
    throw failure;
  } });

  await assert.rejects(engine.search('sources', new AbortController().signal), (error) => error === failure);
  assert.equal(calls, 1);
});

test('Given cancellation before search, when it is called, then the same abort reason is thrown without fetching', async () => {
  const controller = new AbortController();
  const reason = new DOMException('Private cancellation detail', 'AbortError');
  controller.abort(reason);
  let called = false;
  const engine = new SearchEngineBraveHttp({ fetchURL: async () => {
    called = true;
    return unknownPage;
  } });

  await assert.rejects(engine.search('sources', controller.signal), (error) => error === reason);
  assert.equal(called, false);
});

for (const outcome of ['resolved', 'rejected'] as const) {
  test(`Given cancellation before the renderer ${outcome}, when fetching settles, then cancellation takes precedence`, async () => {
    const controller = new AbortController();
    const reason = new DOMException('Private cancellation detail', 'AbortError');
    const engine = new SearchEngineBraveHttp({ fetchURL: async () => {
      controller.abort(reason);
      if (outcome === 'rejected') throw new Error('Private late renderer failure');
      return unknownPage;
    } });

    await assert.rejects(engine.search('sources', controller.signal), (error) => error === reason);
  });
}
