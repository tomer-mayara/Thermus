import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProcessHtmlStep } from '../../../src/html-cleaner-pipeline/process-html-step.ts';
import type { Ctx } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import type { WebsiteFetchResult } from '../../../src/website-fetcher/website-fetcher.ts';

const page: WebsiteFetchResult = { requestedUrl: 'HTTPS://Source.Example/Page', finalUrl: 'https://destination.example/final', html: '<p>Source</p>' };

for (const markdown of ['\n# Exact title\n\nBody 😃\n', '']) {
  test(`Given ${markdown === '' ? 'empty' : 'exact'} Markdown and internal warnings, when the page is processed, then only the unchanged string is returned`, async (t) => {
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({
      ...source, removed: 2, skipped: 1, markdown, title: 'Internal title', warnings: ['HTML scan failed; remaining HTML withheld'],
    }));
    const signal = new AbortController().signal;

    assert.deepEqual(await new ProcessHtmlStep({ process }).execute(page, signal), { decision: 'allow', output: markdown });

    assert.equal(process.mock.callCount(), 1);
    assert.deepEqual(process.mock.calls[0].arguments, [page, signal]);
    assert.deepEqual(page, { requestedUrl: 'HTTPS://Source.Example/Page', finalUrl: 'https://destination.example/final', html: '<p>Source</p>' });
  });
}

for (const markdown of [undefined, null, 42, { text: 'must not serialize' }]) {
  test(`Given nonstring Markdown ${JSON.stringify(markdown)}, when the pipeline returns it, then the processor refuses the result`, async () => {
    const pipeline = { process: async () => ({ ...page, removed: 0, skipped: 0, markdown }) as unknown as Ctx };

    await assert.rejects(new ProcessHtmlStep(pipeline).execute(page, new AbortController().signal), { message: 'Page processing failed' });
  });
}

for (const result of [undefined, null]) {
  test(`Given an absent pipeline result ${result}, when processing returns, then the processor refuses the result`, async () => {
    const pipeline = { process: async () => result as unknown as Ctx };

    await assert.rejects(new ProcessHtmlStep(pipeline).execute(page, new AbortController().signal), { message: 'Page processing failed' });
  });
}

for (const html of ['x'.repeat(10 * 1024 * 1024 + 1), '😃'.repeat(10 * 1024 * 1024 / 4) + 'x']) {
  test(`Given HTML of ${Buffer.byteLength(html, 'utf8')} bytes and ${html.length} UTF-16 units, when processed, then the limit prevents pipeline entry`, async (t) => {
    const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'Unused' }));

    await assert.rejects(new ProcessHtmlStep({ process }).execute({ ...page, html }, new AbortController().signal), {
      name: 'RangeError', message: 'HTML input exceeds the 10 MiB limit',
    });

    assert.equal(process.mock.callCount(), 0);
  });
}

test('Given exactly 10 MiB of UTF-8 HTML, when processed, then the pipeline receives the complete input', async (t) => {
  const html = '😃'.repeat(10 * 1024 * 1024 / 4);
  const process = t.mock.fn(async (source: WebsiteFetchResult): Promise<Ctx> => ({ ...source, removed: 0, skipped: 0, markdown: 'Exact Markdown' }));

  assert.deepEqual(await new ProcessHtmlStep({ process }).execute({ ...page, html }, new AbortController().signal), { decision: 'allow', output: 'Exact Markdown' });
  assert.equal(process.mock.calls[0].arguments[0].html, html);
});

for (const code of ['scan_failed', 'scan_limit'] as const) {
  test(`Given typed ${code} and partial Markdown, when the incoming step processes once, then it blocks without any output and ignores warning words`, async (t) => {
    const process = t.mock.fn(async (): Promise<Ctx> => ({ ...page, removed: 1, skipped: 0, scanWithholding: code,
      markdown: 'private-partial-markdown', warnings: ['changed warning words'] }));
    const step = new ProcessHtmlStep({ process });

    assert.equal(step.id, 'incoming.process_html');
    assert.deepEqual(await step.execute(page, new AbortController().signal), { decision: 'block', code });
    assert.equal(process.mock.callCount(), 1);
  });
}

for (const scanWithholding of ['private-unknown-code', null, 42]) {
  test(`Given invalid typed withholding ${scanWithholding}, when processing returns, then the step refuses all payload`, async () => {
    const process = async () => ({ ...page, removed: 0, skipped: 0, scanWithholding, markdown: 'private-payload' }) as unknown as Ctx;

    await assert.rejects(new ProcessHtmlStep({ process }).execute(page, new AbortController().signal), { message: 'Page processing failed' });
  });
}

for (const code of [undefined, 'scan_failed'] as const) {
  test(`Given changing pipeline field getters with ${code ?? 'release'}, when the step checks its result, then it reads each decision field once`, async () => {
    const reads = { scanWithholding: 0, markdown: 0 };
    const process = async (): Promise<Ctx> => ({ ...page, removed: 0, skipped: 0,
      get scanWithholding() { reads.scanWithholding += 1; return reads.scanWithholding === 1 ? code : 'scan_limit'; },
      get markdown() { reads.markdown += 1; return reads.markdown === 1 ? 'Exact Markdown' : 'private-changed-payload'; },
    });

    assert.deepEqual(await new ProcessHtmlStep({ process }).execute(page, new AbortController().signal), code
      ? { decision: 'block', code } : { decision: 'allow', output: 'Exact Markdown' });
    assert.equal(reads.scanWithholding, 1);
    assert.equal(reads.markdown, code ? 0 : 1);
  });
}

test('Given an array with Markdown fields, when the pipeline returns it, then the step refuses the malformed result', async () => {
  const process = async () => Object.assign([], { markdown: 'private-payload' }) as unknown as Ctx;

  await assert.rejects(new ProcessHtmlStep({ process }).execute(page, new AbortController().signal), { message: 'Page processing failed' });
});
