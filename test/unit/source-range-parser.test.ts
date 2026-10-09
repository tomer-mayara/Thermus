import assert from 'node:assert/strict';
import { Parser, Token } from 'parse5';
import { test } from 'node:test';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { SourceRangeParser } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/source-range-parser.ts';

type ParentNode = Htmlparser2TreeAdapterMap['parentNode'];

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

test('recovers nested templates with one active EOF pass', (t) => {
  const originalOnEof = Parser.prototype.onEof;
  let activeCalls = 0;
  let maximumActiveCalls = 0;
  t.mock.method(Parser.prototype, 'onEof', function (
    this: Parser<Htmlparser2TreeAdapterMap>,
    token: Token.EOFToken,
  ) {
    activeCalls += 1;
    maximumActiveCalls = Math.max(maximumActiveCalls, activeCalls);
    try {
      return originalOnEof.call(this, token);
    } finally {
      activeCalls -= 1;
    }
  });
  const html = '<template>'.repeat(64) + 'text';
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
  for (let depth = 0; depth < 63; depth += 1) {
    assert.equal(template.name, 'template');
    const next = adapter.getTemplateContent(template).children[0];
    assert.ok(next !== undefined && adapter.isElementNode(next));
    template = next;
  }
  assert.equal(template.name, 'template');
  const text = adapter.getTemplateContent(template).children[0];
  assert.ok(text !== undefined && adapter.isTextNode(text));
  assert.equal(text.data, 'text');
  assert.equal(maximumActiveCalls, 1);
});
