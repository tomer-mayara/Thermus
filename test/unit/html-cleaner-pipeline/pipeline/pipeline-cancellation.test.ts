import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  HtmlToMarkdownPipeline,
  type Ctx,
} from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

const page = {
  requestedUrl: 'https://source.example/start',
  finalUrl: 'https://destination.example/article',
  html: '<p>Source</p>',
};

describe('HTML pipeline per-call cancellation', () => {
  test('Given a cancelled call, when processing starts, then no stage runs', async (t) => {
    const invoke = t.mock.fn(async (ctx: Ctx) => ctx);
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(new HtmlToMarkdownPipeline([{ invoke }]).process(page, controller.signal), {
      name: 'AbortError',
    });

    assert.equal(invoke.mock.callCount(), 0);
  });

  test('Given cancellation during a stage, when that stage resolves, then later stages do not run', async (t) => {
    const controller = new AbortController();
    const later = t.mock.fn(async (ctx: Ctx) => ({ ...ctx, markdown: 'must not return' }));
    const pipeline = new HtmlToMarkdownPipeline([
      { async invoke(ctx) { controller.abort(); return ctx; } },
      { invoke: later },
    ]);

    await assert.rejects(pipeline.process(page, controller.signal), { name: 'AbortError' });

    assert.equal(later.mock.callCount(), 0);
  });

  test('Given cancellation in the last stage, when it returns Markdown, then processing does not succeed', async () => {
    const controller = new AbortController();
    const pipeline = new HtmlToMarkdownPipeline([
      { async invoke(ctx) { controller.abort(); return { ...ctx, markdown: 'partial output' }; } },
    ]);

    await assert.rejects(pipeline.process(page, controller.signal), { name: 'AbortError' });
  });

  test('Given a cancelled call and no stages, when processing starts, then cancellation still applies', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(new HtmlToMarkdownPipeline([]).process(page, controller.signal), { name: 'AbortError' });
  });

  test('Given two concurrent calls, when one is cancelled, then the other keeps its own state and succeeds', async () => {
    const first = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();
    const controller = new AbortController();
    const seen: Ctx[] = [];
    const pipeline = new HtmlToMarkdownPipeline([
      {
        async invoke(ctx) {
          seen.push(ctx);
          await (ctx.html === 'first' ? first.promise : second.promise);
          ctx.removed += ctx.html === 'first' ? 1 : 2;
          return { ...ctx, warnings: [ctx.html], markdown: ctx.html };
        },
      },
    ]);
    const firstPage = { ...page, html: 'first' };
    const secondPage = { ...page, html: 'second' };
    const cancelled = pipeline.process(firstPage, controller.signal);
    const succeeded = pipeline.process(secondPage, new AbortController().signal);
    const rejected = assert.rejects(cancelled, { name: 'AbortError' });

    controller.abort();
    second.resolve();
    const result = await succeeded;
    first.resolve();
    await rejected;

    assert.notEqual(seen[0], seen[1]);
    assert.equal(result.markdown, 'second');
    assert.equal(result.removed, 2);
    assert.deepEqual(result.warnings, ['second']);
    assert.deepEqual(firstPage, { ...page, html: 'first' });
    assert.deepEqual(secondPage, { ...page, html: 'second' });
    assert.equal((await pipeline.process({ ...page, html: 'later' })).removed, 2);
  });
});
