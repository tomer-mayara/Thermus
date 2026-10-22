import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { BraveHTTPResultCleanup } from '../../../../src/pipelines/html-processing/search-results/brave-http-result-cleanup.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { ProcessHtmlStep } from '../../../../src/pipelines/html-processing/process-html-step.ts';
import { micromark } from 'micromark';
import { createContext } from '../fixtures/html-cleaner-context.ts';

function card(title = 'Safe title', href = '/guide', snippet = 'Useful <strong>description</strong>.'): string {
  return `<div class="snippet" data-type="web"><div class="result-content"><a class="l1" href="${href}"><img src="/favicon"><cite>Breadcrumb</cite><div class="title search-snippet-title">${title}</div></a><div class="generic-snippet"><div class="content">${snippet}</div></div></div></div>`;
}

function page(cards: string, head = ''): string {
  return `<html><head>${head}</head><body><nav>Goggles</nav><main id="search-page"><section id="mixed-main">${cards}</section></main><footer>Privacy Policy</footer></body></html>`;
}

const cleaner = new BraveHTTPResultCleanup();

test('Given supported organic cards and chrome, when cleanup runs, then only numbered result fields remain and the input metadata stays intact', async () => {
  const input = createContext(page(card('One') + card('Two', 'https://other.test/path', 'Privacy Policy explained.')), { removed: 3, skipped: 2, found: ['prior'], warnings: ['notice'] });
  const original = structuredClone(input);
  const result = await cleaner.invoke(input);
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelectorAll('ol > li').length, 2);
  assert.deepEqual([...document.querySelectorAll('li > a')].map((a) => [a.textContent, a.getAttribute('href')]), [['One', 'https://example.com/guide'], ['Two', 'https://other.test/path']]);
  assert.match(document.body.textContent, /Privacy Policy explained/);
  assert.equal(document.querySelector('nav, footer, img, cite'), null);
  assert.deepEqual(input, original);
  assert.equal(result.removed, 3);
  assert.equal(result.skipped, 2);
  assert.deepEqual(result.found, ['prior']);
  assert.deepEqual(result.warnings, ['notice']);
  assert.equal(result.markdown, undefined);
});

for (const [base, expected] of [['', 'https://example.com/guide'], ['<base href="../docs/">', 'https://example.com/docs/guide'], ['<base href="http://[">', 'https://example.com/guide']] as const) {
  test(`Given base ${base || 'absent'}, when cleanup resolves relative destinations, then primary and description links use the effective base`, async () => {
    const result = await cleaner.invoke(createContext(page(card('Safe', 'guide', '<a href="guide">details</a>'), base)));
    const { document } = parseHTML(result.html);
    assert.deepEqual([...document.querySelectorAll('a')].map((a) => a.getAttribute('href')), [expected, expected]);
  });
}

test('Given encoded controls in required fields and base, when cleanup checks eligibility, then it normalizes before checking and never resolves blank destinations', async () => {
  const source = card('&#x202e;', '/bad', 'DROP TITLE') + card('Blank URL', '&#x202e;', 'DROP URL')
    + card('Unsafe', 'javascript:alert(1)', 'DROP SCHEME') + card('&#xfeff;Good', 'left&#x202e;right', 'Keep &amp;#x202e; literal');
  const result = await cleaner.invoke(createContext(page(source, '<base href="https://ex&#x202e;ample.org/docs/">')));
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelectorAll('li').length, 1);
  assert.equal(document.querySelector('li > a')?.textContent, 'Good');
  assert.equal(document.querySelector('li > a')?.getAttribute('href'), 'https://example.org/docs/leftright');
  assert.match(document.body.textContent, /Keep &#x202e; literal/);
  assert.doesNotMatch(result.html, /DROP/);
  assert.ok(result.found?.includes('cf-format'));
  assert.ok(result.warnings?.length);
});

test('Given non-display title and snippet descendants, when cleanup copies fields, then it cannot turn those descendants into visible text', async () => {
  const result = await cleaner.invoke(createContext(page(card('Safe<script>BAD TITLE</script>', '/guide', 'Visible <a href="/detail">detail</a><script>BAD SCRIPT</script><style>BAD STYLE</style><template>BAD TEMPLATE</template><span hidden>BAD HIDDEN</span><img src="/thumb">'))));
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelector('li > a')?.textContent, 'Safe');
  assert.match(document.body.textContent, /Visible detail/);
  assert.doesNotMatch(result.html, /BAD|<img|<script|<style|<template/);
  assert.equal(document.querySelector('p a')?.getAttribute('href'), 'https://example.com/detail');
});

test('Given a video description and an optional missing description, when cleanup runs, then both organic titles remain without carousel metadata', async () => {
  const video = card('Video').replace('<div class="generic-snippet"><div class="content">Useful <strong>description</strong>.</div></div>', '<div class="video-snippet" data-macro="video"><div class="content"><div class="desktop-default-regular line-clamp-2">Actual description</div><div>CAROUSEL META</div></div></div>');
  const result = await cleaner.invoke(createContext(page(video + card('No description', '/other', ''))));
  const { document } = parseHTML(result.html);
  assert.equal(document.querySelectorAll('li').length, 2);
  assert.match(document.body.textContent, /Actual description/);
  assert.doesNotMatch(result.html, /CAROUSEL META/);
});

test('Given an inline question and a sibling answer widget, when cleanup copies the organic description, then it keeps question paragraphs and safe links without answers or votes', async () => {
  const question = '<div class="inline-qa-question"><span>January 8, 2026 -</span><p>First question paragraph.</p><p>Second question with <a href="/details">details</a>.</p></div>';
  const answer = '<div class="inline-qa"><a href="/answer"><div class="inline-qa-upvotes">42 votes</div><div class="inline-qa-answer">Top answer: excluded</div></a></div>';
  const source = card().replace('<div class="generic-snippet"><div class="content">Useful <strong>description</strong>.</div></div>', question)
    .replace('</div></div>', `</div>${answer}</div>`);

  const result = await cleaner.invoke(createContext(page(source)));

  const { document } = parseHTML(result.html);
  assert.equal(document.querySelectorAll('li').length, 1);
  assert.equal(document.querySelector('li > a')?.textContent, 'Safe title');
  assert.match(document.body.textContent, /January 8, 2026 -.*First question paragraph\..*Second question with details\./s);
  assert.equal(document.querySelector('p a')?.getAttribute('href'), 'https://example.com/details');
  assert.doesNotMatch(result.html, /Top answer|42 votes|\/answer|inline-qa/);
});

test('Given unsafe and hidden inline question fields, when cleanup and conversion run, then only safe visible description text and destinations remain', async () => {
  const question = '<div class="inline-qa-question"><p>Before&#x202e; <a href="javascript:alert(1)">unsafe link as text</a> and <a href="/details">safe details</a>.</p>'
    + '<p>After<script>BAD SCRIPT</script><style>BAD STYLE</style><template>BAD TEMPLATE</template><span hidden>BAD HIDDEN</span><img src="/thumb"></p></div>';
  const source = card().replace('<div class="generic-snippet"><div class="content">Useful <strong>description</strong>.</div></div>', question);

  const result = await new HtmlToMarkdownPipeline([cleaner, new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true })]).process(createContext(page(source)));

  const rendered = micromark(result.markdown ?? '');
  const { document } = parseHTML(`<html><body>${rendered}</body></html>`);
  assert.match(document.body.textContent, /Before unsafe link as text and safe details\./);
  assert.match(document.body.textContent, /After/);
  assert.deepEqual([...document.querySelectorAll('a')].map((anchor) => anchor.getAttribute('href')), ['https://example.com/guide', 'https://example.com/details']);
  assert.doesNotMatch(rendered, /BAD|javascript:|\u202e|<script|<style|<template|<img/);
  assert.ok(result.found?.includes('cf-format'));
});

for (const html of ['', page(''), page(card('&#x202e;'))]) {
  test('Given no eligible rows, when cleanup runs, then HTML is exactly empty', async () => {
    const result = await cleaner.invoke(createContext(html));
    assert.equal(result.html, '');
  });
}

for (const scanWithholding of ['scan_failed', 'scan_limit'] as const) {
  test(`Given ${scanWithholding}, when cleanup runs, then it passes empty HTML with the original flag and reports`, async () => {
    const input = createContext(page(card()), { scanWithholding, found: ['prior'] });
    const result = await cleaner.invoke(input);
    assert.deepEqual(result, { ...input, html: '' });
  });
}

test('Given repeated concurrent calls, when one cleanup instance runs, then no result fields or reports leak between calls', async () => {
  const results = await Promise.all([cleaner.invoke(createContext(page(card('First')))), cleaner.invoke(createContext(page(card('Second'))))]);
  assert.doesNotMatch(results[0].html, /Second/);
  assert.doesNotMatch(results[1].html, /First/);
});

test('Given repeated decoded detections and existing metadata, when cleanup accumulates reports, then findings stay unique and do not leak to the next request', async () => {
  const result = await cleaner.invoke(createContext(page(card('One&#x202e;', '/one') + card('Two&#x202e;', '/two')), { found: ['prior', 'cf-format'], warnings: ['notice'] }));
  assert.deepEqual(result.found, ['prior', 'cf-format']);
  assert.equal(new Set(result.warnings).size, result.warnings?.length);
  assert.equal(result.warnings?.[0], 'notice');
  const next = await cleaner.invoke(createContext(page(card('Clean'))));
  assert.deepEqual(next.found, []);
  assert.deepEqual(next.warnings, []);
});

test('Given punctuation and safe and unsafe snippet links, when cleanup and real conversion run, then text and approved destinations stay associated with one row', async () => {
  const input = createContext(page(card('[Title] *literal*', '/guide?a=1&amp;b=2', 'Read <a href="javascript:alert(1)">unsafe destination as text</a> and <a href="/details">safe details</a>.')));
  const result = await new HtmlToMarkdownPipeline([cleaner, new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true })]).process(input);
  const { document } = parseHTML(`<html><body>${micromark(result.markdown ?? '')}</body></html>`);
  const row = document.querySelector('ol > li');
  assert.ok(row);
  assert.equal(row.querySelector('a')?.textContent, '[Title] *literal*');
  assert.deepEqual([...row.querySelectorAll('a')].map((link) => link.getAttribute('href')), ['https://example.com/guide?a=1&b=2', 'https://example.com/details']);
  assert.match(row.textContent, /unsafe destination as text/);
});

test('Given escaped numeric entity text, when the existing converter runs with and without cleanup, then raw Markdown keeps the same literal entity without a second cleanup decode', async (t) => {
  const input = createContext(page(card('Title &amp;#x202e;', '/guide', 'Keep &amp;#x202e; literal.')));
  const converter = new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true });
  const baseline = await converter.invoke(input);
  const projected = await cleaner.invoke(input);
  const cleaned = await converter.invoke(projected);
  assert.match(parseHTML(projected.html).document.body.textContent, /Title &#x202e;/);
  for (const result of [baseline, cleaned]) {
    assert.match(result.markdown ?? '', /Title &#x202e;/);
    assert.match(result.markdown ?? '', /Keep &#x202e; literal/);
    assert.doesNotMatch(result.markdown ?? '', /\u202e/);
  }
  const rendered = parseHTML(`<html><body>${micromark(baseline.markdown ?? '')}</body></html>`).document;
  t.diagnostic(`Existing converter baseline: ${JSON.stringify(baseline.markdown)}; cleanup: ${JSON.stringify(cleaned.markdown)}; baseline rendered text: ${JSON.stringify(rendered.body.textContent)}`);
});

test('Given a same-ID div outside the validated section, when cleanup selects cards, then its card is excluded', async () => {
  const input = page(card('Visible')).replace('</body>', `<div id="mixed-main">${card('OUTSIDE')}</div></body>`);
  const result = await cleaner.invoke(createContext(input));
  assert.doesNotMatch(result.html, /OUTSIDE/);
  assert.equal(parseHTML(result.html).document.querySelectorAll('li').length, 1);
});

test('Given inert card ancestors and hidden field roots, when cleanup projects rows, then inert cards and hidden text cannot become visible', async () => {
  const input = page(card('Visible') + `<template>${card('INERT TEMPLATE')}</template><noscript>${card('INERT NOSCRIPT')}</noscript>`
    + card('HIDDEN TITLE').replace('class="title search-snippet-title"', 'hidden class="title search-snippet-title"')
    + card('Optional', '/other', 'HIDDEN DESCRIPTION').replace('class="content"', 'hidden class="content"'));
  const result = await cleaner.invoke(createContext(input));
  assert.doesNotMatch(result.html, /INERT|HIDDEN/);
  assert.equal(parseHTML(result.html).document.querySelectorAll('li').length, 2);
});

test('Given a valid non-HTTP base, when cleanup resolves destinations, then absolute HTTP results survive and unresolvable relative destinations are dropped', async () => {
  const result = await cleaner.invoke(createContext(page(card('DROP RELATIVE', 'guide') + card('Absolute', 'https://safe.test/guide'), '<base href="mailto:person@example.com">')));
  const { document } = parseHTML(result.html);
  assert.doesNotMatch(result.html, /DROP RELATIVE/);
  assert.equal(document.querySelector('a')?.getAttribute('href'), 'https://safe.test/guide');
});

test('Given an encoded terminal control split across inline description nodes, when cleanup and conversion run, then run sanitation removes the whole control and keeps visible words', async () => {
  const source = page(card('Safe', '/guide', 'Before <span>&#x1b;]8;;https://evil.test</span>&#x7;visible<span>&#x1b;]8;;</span>&#x7; after'));
  const result = await new HtmlToMarkdownPipeline([cleaner, new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true })]).process(createContext(source));
  assert.match(result.markdown ?? '', /Before visible after/);
  assert.doesNotMatch(result.markdown ?? '', /evil|\u001b|\u0007/);
  assert.ok(result.found?.includes('ansi'));
});

test('Given a malformed withholding flag, when the incoming step runs cleanup, then processing fails closed', async () => {
  const pipeline = new HtmlToMarkdownPipeline([{
    invoke: async (ctx) => ({ ...ctx, scanWithholding: 'unknown' as 'scan_failed' }),
  }, cleaner, new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true })]);
  await assert.rejects(new ProcessHtmlStep(pipeline).execute(createContext(page(card())), new AbortController().signal));
});
