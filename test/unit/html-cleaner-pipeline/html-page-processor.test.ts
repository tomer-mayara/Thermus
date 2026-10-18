import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HtmlPageProcessor } from '../../../src/html-cleaner-pipeline/html-page-processor.ts';
import type { Ctx } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const page: WebsiteFetchResult = { requestedUrl: 'HTTPS://Source.Example/Page', finalUrl: 'https://destination.example/final', html: '<p>Source</p>' };

for (const markdown of ['\n# Exact title\n\nBody 😃\n', '']) {
  test(`Given ${markdown === '' ? 'empty' : 'exact'} Markdown and internal warnings, when the page is processed, then only the unchanged string is returned`, async (t) => {
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({
      ...source, removed: 2, skipped: 1, markdown, title: 'Internal title', warnings: ['HTML scan failed; remaining HTML withheld'],
    }));
    const signal = new AbortController().signal;

    assert.equal(await new HtmlPageProcessor({ process }).process(page, signal), markdown);

    assert.equal(process.mock.callCount(), 1);
    assert.deepEqual(process.mock.calls[0].arguments, [page, signal]);
    assert.deepEqual(page, { requestedUrl: 'HTTPS://Source.Example/Page', finalUrl: 'https://destination.example/final', html: '<p>Source</p>' });
  });
}

for (const markdown of [undefined, null, 42, { text: 'must not serialize' }]) {
  test(`Given nonstring Markdown ${JSON.stringify(markdown)}, when the pipeline returns it, then the processor refuses the result`, async () => {
    const pipeline = { process: async () => ({ ...page, removed: 0, skipped: 0, markdown }) as unknown as Ctx };

    await assert.rejects(new HtmlPageProcessor(pipeline).process(page, new AbortController().signal), { message: 'Page processing failed' });
  });
}

for (const result of [undefined, null]) {
  test(`Given an absent pipeline result ${result}, when processing returns, then the processor refuses the result`, async () => {
    const pipeline = { process: async () => result as unknown as Ctx };

    await assert.rejects(new HtmlPageProcessor(pipeline).process(page, new AbortController().signal), { message: 'Page processing failed' });
  });
}

for (const html of ['x'.repeat(10 * 1024 * 1024 + 1), '😃'.repeat(10 * 1024 * 1024 / 4) + 'x']) {
  test(`Given HTML of ${Buffer.byteLength(html, 'utf8')} bytes and ${html.length} UTF-16 units, when processed, then the limit prevents pipeline entry`, async (t) => {
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'Unused' }));

    await assert.rejects(new HtmlPageProcessor({ process }).process({ ...page, html }, new AbortController().signal), {
      name: 'RangeError', message: 'HTML input exceeds the 10 MiB limit',
    });

    assert.equal(process.mock.callCount(), 0);
  });
}

test('Given exactly 10 MiB of UTF-8 HTML, when processed, then the pipeline receives the complete input', async (t) => {
  const html = '😃'.repeat(10 * 1024 * 1024 / 4);
  const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'Exact Markdown' }));

  assert.equal(await new HtmlPageProcessor({ process }).process({ ...page, html }, new AbortController().signal), 'Exact Markdown');
  assert.equal(process.mock.calls[0].arguments[0].html, html);
});
