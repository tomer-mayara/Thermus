import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import adblockRust from 'adblock-rs';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import {
  HtmlDepthLimitError,
  MAX_HTML_ELEMENT_DEPTH,
} from '../../src/html-cleaner-pipeline/ad-cleaner/html-depth-limit-error.ts';
import { createContext } from '../support/html-cleaner-context.ts';

const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';

function nestedHtml(depth: number, content = 'text'): string {
  return '<div>'.repeat(depth) + content + '</div>'.repeat(depth);
}

describe('ad cleaner depth limit', () => {
  const limitError = {
    name: 'HtmlDepthLimitError',
    message: 'HTML input exceeds the 256 element depth limit',
  };

  test('exports the documented depth limit and error', () => {
    assert.equal(MAX_HTML_ELEMENT_DEPTH, 256);
    const error = new HtmlDepthLimitError();
    assert.ok(error instanceof Error);
    assert.equal(error.name, limitError.name);
    assert.equal(error.message, limitError.message);
  });

  for (const url of ['https://example.com/', elementHidingUrl]) {
    test(`rejects 5,000 nested elements at ${url}`, async (t) => {
      const input = createContext(nestedHtml(5000), {
        finalUrl: url,
        removed: 3,
        skipped: 5,
      });
      const original = { ...input };
      const selectors = t.mock.method(adblockRust.Engine.prototype, 'urlCosmeticResources');

      await assert.rejects(new CleanHtmlAdsAdblockRs().invoke(input), (error: unknown) => {
        assert.ok(error instanceof HtmlDepthLimitError);
        assert.equal(error.message, limitError.message);
        return true;
      });
      assert.equal(selectors.mock.callCount(), 0);
      assert.deepEqual(input, original);
    });

    test(`rejects 5,000 unclosed templates at ${url}`, async (t) => {
      const input = createContext('<template>'.repeat(5000) + 'text', {
        finalUrl: url,
        removed: 3,
        skipped: 5,
      });
      const original = { ...input };
      const selectors = t.mock.method(adblockRust.Engine.prototype, 'urlCosmeticResources');

      await assert.rejects(new CleanHtmlAdsAdblockRs().invoke(input), (error: unknown) => {
        assert.ok(error instanceof HtmlDepthLimitError);
        assert.equal(error.message, limitError.message);
        return true;
      });
      assert.equal(selectors.mock.callCount(), 0);
      assert.deepEqual(input, original);
    });
  }

  for (const [element, makeHtml] of [
    ['div', (depth: number) => nestedHtml(depth - 2, 'text<!-- comment -->')],
    ['template', (depth: number) => '<template>'.repeat(depth - 2) + 'text'],
  ] as const) {
    for (const depth of [255, 256, 257]) {
      test(`checks the ${element} depth boundary at ${depth} elements`, async () => {
        // parse5 adds two elements when the input omits html, head, and body.
        const html = makeHtml(depth);
        const input = createContext(html, {
          requestedUrl: 'https://example.com/',
          finalUrl: 'https://example.com/',
        });
        const operation = new CleanHtmlAdsAdblockRs().invoke(input);

        if (depth > 256) {
          await assert.rejects(operation, limitError);
        } else {
          assert.deepEqual(await operation, input);
        }
      });
    }
  }

  test('removes a matching sibling and keeps unclosed templates at the limit', async () => {
    const html = '<div class="eh-class">ad</div>' + '<template>'.repeat(254) + 'keep';
    const result = await new CleanHtmlAdsAdblockRs().invoke(createContext(
      html, { finalUrl: elementHidingUrl },
    ));

    assert.equal(result.html, '<template>'.repeat(254) + 'keep');
    assert.equal(result.removed, 1);
    assert.equal(result.skipped, 1);
  });

  test('removes nested selector targets at the limit and keeps other content', async () => {
    const content = '<section class="testcase-area"><b class="eh-descendant">ad</b>'
      + '<b id="eh-id">id ad</b><b class="eh-class">class ad</b>'
      + '<i class="testcase-examplecontent">keep</i><b class="eh-sibling">sibling ad</b>'
      + '<p>visible</p></section>';
    const result = await new CleanHtmlAdsAdblockRs().invoke(createContext(
      nestedHtml(252, content), { finalUrl: elementHidingUrl },
    ));

    assert.equal(result.html, nestedHtml(252,
      '<section class="testcase-area"><i class="testcase-examplecontent">keep</i>'
      + '<p>visible</p></section>',
    ));
    assert.equal(result.removed, 4);
    assert.equal(result.skipped, 1);
  });

  test('collects nested class and ID tokens for generic selectors', async (t) => {
    const hidden = t.mock.method(adblockRust.Engine.prototype, 'hiddenClassIdSelectors',
      (classes: string[], ids: string[]) => {
        assert.deepEqual(new Set(classes), new Set(['outer', 'inner', 'target', 'keep']));
        assert.deepEqual(new Set(ids), new Set(['outer-id', 'target-id']));
        assert.equal(classes.length, 4);
        assert.equal(ids.length, 2);
        return ['.inner > #target-id.target'];
      },
    );
    const content = '<section id="outer-id" class="outer inner">'
      + '<b id="target-id" class=" target\tinner\n ">ad</b>'
      + '<p id="" class="keep">keep</p></section>';
    const result = await new CleanHtmlAdsAdblockRs().invoke(createContext(
      nestedHtml(252, content), { finalUrl: 'https://example.com/' },
    ));

    assert.equal(hidden.mock.callCount(), 1);
    assert.equal(result.html, nestedHtml(252,
      '<section id="outer-id" class="outer inner"><p id="" class="keep">keep</p></section>',
    ));
    assert.equal(result.removed, 1);
    assert.equal(result.skipped, 0);
  });

  test('allows template content at the depth limit', async () => {
    const html = nestedHtml(252, '<template><span>keep</span></template>');
    const input = createContext(html, { finalUrl: 'https://example.com/' });

    assert.deepEqual(await new CleanHtmlAdsAdblockRs().invoke(input), input);
  });

  test('rejects template children beyond the depth limit', async () => {
    const html = nestedHtml(253, '<template><span>x</span></template>');

    await assert.rejects(new CleanHtmlAdsAdblockRs().invoke(createContext(
      html, { finalUrl: 'https://example.com/' },
    )), limitError);
  });

  test('enforces the limit when generic hiding is disabled', async (t) => {
    t.mock.method(adblockRust.Engine.prototype, 'urlCosmeticResources', () => ({
      hide_selectors: [], procedural_actions: [], exceptions: [], injected_script: '',
      generichide: true,
    }));
    const hidden = t.mock.method(adblockRust.Engine.prototype, 'hiddenClassIdSelectors');

    await assert.rejects(new CleanHtmlAdsAdblockRs().invoke(createContext(
      nestedHtml(255), { finalUrl: 'https://example.com/' },
    )), limitError);
    assert.equal(hidden.mock.callCount(), 0);
  });

  for (const tag of ['script', 'style', 'span', 'template']) {
    test(`counts ${tag} elements in the depth limit`, async () => {
      await assert.rejects(new CleanHtmlAdsAdblockRs().invoke(createContext(
        nestedHtml(254, `<${tag}>text</${tag}>`),
        { finalUrl: 'https://example.com/' },
      )), limitError);
    });
  }
});
