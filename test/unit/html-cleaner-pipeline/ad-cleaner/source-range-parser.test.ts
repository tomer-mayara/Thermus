import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { SourceRangeParser } from '../../../../src/pipelines/html-processing/ad-cleaner/adb/source-range-parser.ts';
import { assertWorkPassesInChild } from './fixtures/parser-child.ts';

type ParentNode = Htmlparser2TreeAdapterMap['parentNode'];

function expectedElement(node: Htmlparser2TreeAdapterMap['node'] | undefined): Htmlparser2TreeAdapterMap['element'] {
  assert.ok(node !== undefined);
  assert.ok(adapter.isElementNode(node));
  return node;
}

test('keeps source locations when leading text closes an implied head without a token', () => {
  const document = SourceRangeParser.parse<Htmlparser2TreeAdapterMap>('plain<div id="eh-id">ad</div>', {
    treeAdapter: adapter,
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
  });
  const htmlElement = expectedElement(document.children[0]);
  const head = expectedElement(htmlElement.children[0]);
  assert.equal(head.name, 'head');
  assert.equal(head.sourceCodeLocation, null);
  const body = expectedElement(htmlElement.children[1]);
  const text = body.children[0];
  assert.ok(text !== undefined);
  assert.ok(adapter.isTextNode(text));
  assert.equal(text.data, 'plain');
  assert.ok(text.sourceCodeLocation);
  assert.equal(text.sourceCodeLocation.startOffset, 0);
  assert.equal(text.sourceCodeLocation.endOffset, 5);
  const ad = expectedElement(body.children[1]);
  assert.ok(ad.sourceCodeLocation);
  assert.equal(ad.sourceCodeLocation.startOffset, 5);
  assert.equal(ad.sourceCodeLocation.endOffset, 29);
  assert.ok(ad.sourceCodeLocation.endTag);
  assert.equal(ad.sourceCodeLocation.endTag.startOffset, 23);
});

function countParentReads(html: string): number {
  let parentReads = 0;
  const countingAdapter = {
    ...adapter,
    createElement(...args: Parameters<typeof adapter.createElement>) {
      const element = adapter.createElement(...args);
      let parent: ParentNode | null = element.parent;
      Object.defineProperty(element, 'parent', {
        configurable: true,
        enumerable: true,
        get() {
          parentReads += 1;
          return parent;
        },
        set(value: ParentNode | null) {
          parent = value;
        },
      });
      return element;
    },
  };
  SourceRangeParser.parse<Htmlparser2TreeAdapterMap>(html, {
    treeAdapter: countingAdapter,
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
  });

  return parentReads;
}

test('keeps EOF ancestor visits bounded for deeply nested unclosed elements', () => {
  const depths = [128, 256];
  const results = depths.flatMap(depth => [
    {
      input: `nested elements, depth ${depth}`,
      depth,
      html: `<body>${'<div>'.repeat(depth)}content`,
    },
    {
      input: `nested elements with body close, depth ${depth}`,
      depth,
      html: `<body>${'<div>'.repeat(depth)}content</body>`,
    },
    {
      input: `repeated form boundaries, depth ${depth}`,
      depth,
      html: `<body>${'<form><div></form>'.repeat(depth)}</body>`,
    },
  ]).map(({ input, depth, html }) => ({
    input,
    depth,
    parentReads: countParentReads(html),
  }));
  // Parent reads keep this check independent of machine speed.
  const overBudget = results.filter(({ parentReads, depth }) => parentReads > depth * 40 + 1000);

  assert.deepEqual(
    overBudget,
    [],
    'Every input must stay within the linear parent-read budget.',
  );
});

test('recovers nested templates with bounded EOF stack depth', () => {
  const html = '<template>'.repeat(5000) + 'text';
  const document = SourceRangeParser.parse<Htmlparser2TreeAdapterMap>(html, {
    treeAdapter: adapter,
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
  });

  const htmlElement = document.children[0];
  assert.ok(htmlElement !== undefined && adapter.isElementNode(htmlElement));
  const head = htmlElement.children[0];
  assert.ok(head !== undefined && adapter.isElementNode(head));
  const outerTemplate = head.children[0];
  assert.ok(outerTemplate !== undefined && adapter.isElementNode(outerTemplate));
  assert.equal(outerTemplate.name, 'template');
  assert.equal(outerTemplate.sourceCodeLocation?.startOffset, 0);
  let template = outerTemplate;
  for (let depth = 0; depth < 4999; depth += 1) {
    assert.equal(template.name, 'template');
    const next = adapter.getTemplateContent(template).children[0];
    assert.ok(next !== undefined && adapter.isElementNode(next));
    template = next;
  }
  assert.equal(template.name, 'template');
  const text = adapter.getTemplateContent(template).children[0];
  assert.ok(text !== undefined && adapter.isTextNode(text));
  assert.equal(text.data, 'text');
});

const parseWorkTimeLimitMs = 3000;

test('stops EOF processing when parse5 has no next pass to request', async () => {
  await assertWorkPassesInChild(`
    for (const [html, hasText] of [
      ['<svg><template><title><template>', false],
      ['<svg><template><title><template>text', true],
    ]) {
      const document = SourceRangeParser.parse(html, {
        treeAdapter: adapter,
        sourceCodeLocationInfo: true,
        scriptingEnabled: false,
      });
      const htmlElement = document.children[0];
      assert.ok(htmlElement !== undefined && adapter.isElementNode(htmlElement));
      const body = htmlElement.children[1];
      assert.ok(body !== undefined && adapter.isElementNode(body));
      const svg = body.children[0];
      assert.ok(svg !== undefined && adapter.isElementNode(svg));
      assert.equal(svg.name, 'svg');
      assert.equal(svg.sourceCodeLocation?.startOffset, 0);
      const template = svg.children[0];
      assert.ok(template !== undefined && adapter.isElementNode(template));
      assert.equal(template.name, 'template');
      assert.equal(template.sourceCodeLocation?.startOffset, 5);
      const title = template.children[0];
      assert.ok(title !== undefined && adapter.isElementNode(title));
      assert.equal(title.name, 'title');
      assert.equal(title.sourceCodeLocation?.startOffset, 15);
      const innerTemplate = title.children[0];
      assert.ok(innerTemplate !== undefined && adapter.isElementNode(innerTemplate));
      assert.equal(innerTemplate.name, 'template');
      assert.equal(innerTemplate.sourceCodeLocation?.startOffset, 22);
      const text = adapter.getTemplateContent(innerTemplate).children[0];
      if (hasText) {
        assert.ok(text !== undefined && adapter.isTextNode(text));
        assert.equal(text.data, 'text');
        assert.equal(text.sourceCodeLocation?.startOffset, 32);
      } else {
        assert.equal(text, undefined);
      }
    }
  `, parseWorkTimeLimitMs);
});
