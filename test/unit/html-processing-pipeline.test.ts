import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import {
  HtmlToMarkdownPipeline,
  type Ctx,
  type Step,
} from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';
const elementHidingHtml = readFileSync(
  join(process.cwd(), 'test/unit/fixtures/element-hiding.html'),
  'utf8',
);

const removedTargetMarkers = [
  'id="eh-id"',
  'class="eh-class"',
  'class="eh-descendant"',
  'class="eh-sibling"',
] as const;

describe('HTML to Markdown Pipeline', () => {
  let pipeline: HtmlToMarkdownPipeline;

  beforeEach(() => {
    pipeline = new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(), new CleanHtmlToMarkdownDefuddle()]);
  });

  test('order is enforced', async () => {
    const result = await pipeline.process(elementHidingUrl, elementHidingHtml);
    const markdown = result.markdown;

    assert.ok(markdown);
    assert.match(markdown, /Example Content/);
    assert.ok(result.removed > 0);

    const cleanedSections = [
      ['## ID Selector\n', '## ID Selector with double curly braces'],
      ['## Class Selector\n', '## Descendant Selector'],
      ['## Descendant Selector\n', '## Sibling Selector'],
      ['## Sibling Selector\n', '## Attribute Selector 1'],
    ] as const;

    for (const [start, end] of cleanedSections) {
      const from = markdown.indexOf(start);
      const to = markdown.indexOf(end, from + start.length);
      assert.notEqual(from, -1, start);
      assert.notEqual(to, -1, end);
      const section = markdown.slice(from, to);
      assert.match(section, /Example Content/);
      assert.doesNotMatch(section, /\nTarget\n/);
    }
  });

  test('counts survive', async () => {
    const cleaned = await new CleanHtmlAdsAdblockRs().invoke({
      url: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });
    const result = await pipeline.process(elementHidingUrl, elementHidingHtml);

    assert.equal(result.removed, cleaned.removed);
    assert.equal(result.skipped, cleaned.skipped);
  });

  test('the markdowner sees cleaned HTML', async () => {
    let seenHtml = '';
    const markdowner: Step = {
      async invoke(ctx) {
        seenHtml = ctx.html;
        return { ...ctx, markdown: '', title: null };
      },
    };
    const local = new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(), markdowner]);

    await local.process(elementHidingUrl, elementHidingHtml);

    for (const marker of removedTargetMarkers) {
      assert.equal(elementHidingHtml.includes(marker), true, marker);
      assert.equal(seenHtml.includes(marker), false, marker);
    }
  });

  test('a throw propagates', async () => {
    let markdownerCalled = false;
    const cleaner: Step = {
      async invoke() {
        throw new Error('cleaner failed');
      },
    };
    const markdowner: Step = {
      async invoke(ctx) {
        markdownerCalled = true;
        return { ...ctx, markdown: '' };
      },
    };
    const local = new HtmlToMarkdownPipeline([cleaner, markdowner]);

    await assert.rejects(() => local.process(elementHidingUrl, elementHidingHtml));
    assert.equal(markdownerCalled, false);
  });

  test('steps do not mutate', async () => {
    let handed: Ctx | undefined;
    const first: Step = {
      async invoke(ctx) {
        handed = ctx;
        return new CleanHtmlAdsAdblockRs().invoke(ctx);
      },
    };
    const local = new HtmlToMarkdownPipeline([first, new CleanHtmlToMarkdownDefuddle()]);

    await local.process(elementHidingUrl, elementHidingHtml);

    assert.deepEqual(handed, {
      url: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });
  });
});
