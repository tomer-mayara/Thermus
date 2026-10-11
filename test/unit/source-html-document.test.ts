import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { adapter, type Htmlparser2TreeAdapterMap } from 'parse5-htmlparser2-tree-adapter';
import { SourceHtmlDocument, type SourceRange, type StyleSource } from '../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts';

function sourceText(html: string, ranges: readonly SourceRange[]): string[] {
  return ranges.map(({ start, end }) => html.slice(start, end));
}

describe('SourceHtmlDocument source queries', () => {
  test('given a fragment, preserves authored mode after standards source recovery', () => {
    const tree = SourceHtmlDocument.parse('<table><p>Moved</p><tr><td>Cell</td></tr></table>');
    const paragraph = tree.elements.find((element) => element.name === 'p');
    assert.ok(paragraph);
    assert.equal(paragraph.parent?.type, 'tag');
    assert.equal((paragraph.parent as Htmlparser2TreeAdapterMap['element']).name, 'body');
    assert.equal(tree.document['x-mode'], 'quirks');
    assert.equal(SourceHtmlDocument.parse('<!doctype html><p>Text</p>').document['x-mode'], 'no-quirks');
    assert.equal(SourceHtmlDocument.parse('').elements.length, 3);
  });

  test('given reconstructed formatting, identifies its authored source and each current tag', () => {
    const html = '<p><b style="color:red">First<p>Second</b></p>';
    const tree = SourceHtmlDocument.parse(html);
    const copies = tree.elements.filter((element) => element.name === 'b');
    assert.equal(copies.length, 2);
    assert.equal(tree.sourceElement(copies[0]), copies[0]);
    assert.equal(tree.sourceElement(copies[1]), copies[0]);
    assert.deepEqual(sourceText(html, tree.elementTagRanges(copies[0])), ['<b style="color:red">']);
    assert.deepEqual(sourceText(html, tree.elementTagRanges(copies[1])), ['<b style="color:red">', '</b>']);
    assert.deepEqual(tree.styleSources(copies[1]), tree.styleSources(copies[0]));
    const locationlessTree = SourceHtmlDocument.parse('<b style="color:red">First<p></b>Second');
    const locationlessCopies = locationlessTree.elements.filter((element) => element.name === 'b');
    assert.equal(locationlessCopies.length, 2);
    assert.equal(locationlessTree.sourceElement(locationlessCopies[1]), locationlessCopies[0]);
    assert.deepEqual(locationlessTree.elementTagRanges(locationlessCopies[1]), []);
    assert.deepEqual(locationlessTree.styleSources(locationlessCopies[1]), locationlessTree.styleSources(locationlessCopies[0]));
  });

  test('given duplicate body tags, returns adopted tag ranges before explicit tags and styles in encounter order', () => {
    const html = '<body style="color:r&#101;d"><p>Text</p><body style="color:blue"><body style="color:blue"></body>';
    const tree = SourceHtmlDocument.parse(html);
    const body = tree.elements.find((element) => element.name === 'body');
    assert.ok(body);
    assert.deepEqual(sourceText(html, tree.elementTagRanges(body)), [
      '<body style="color:blue">', '<body style="color:blue">', '<body style="color:r&#101;d">', '</body>',
    ]);
    const styles = tree.styleSources(body);
    assert.deepEqual(styles.map(({ range }) => html.slice(range.start, range.end)), [
      'style="color:r&#101;d"', 'style="color:blue"', 'style="color:blue"',
    ]);
    assert.deepEqual(styles.map(({ decodedValues }) => decodedValues), [['color:red'], ['color:blue'], ['color:blue']]);
  });

  test('given an implied body and fostered content, keeps adopted tokens and only explicit table tags', () => {
    const html = '<p>Before</p><body style="color:red"><table><p>Moved</p><tr><td>Cell</td></tr></table>';
    const tree = SourceHtmlDocument.parse(html);
    const body = tree.elements.find((element) => element.name === 'body');
    const table = tree.elements.find((element) => element.name === 'table');
    assert.ok(body);
    assert.ok(table);
    assert.deepEqual(sourceText(html, tree.elementTagRanges(body)), ['<body style="color:red">']);
    assert.deepEqual(sourceText(html, tree.elementTagRanges(table)), ['<table>', '</table>']);
    assert.deepEqual(tree.styleSources(table), []);
  });

  test('given joined fostered text tokens, returns disjoint UTF-16 source ranges and preserves missing-source failure', () => {
    const html = '😀 &amp; before<table>after &#x1f600;<tr><td>Cell</td></tr></table>';
    const tree = SourceHtmlDocument.parse(html);
    const body = tree.elements.find((element) => element.name === 'body');
    assert.ok(body);
    const text = body.children.find(adapter.isTextNode);
    assert.ok(text);
    const ranges = tree.textRanges(text);
    assert.deepEqual(sourceText(html, ranges), ['😀 &amp; before', 'after &#x1f600;']);
    assert.equal(ranges[0].end, '😀 &amp; before'.length);
    assert.equal(ranges[1].start, html.indexOf('after'));
    assert.throws(() => tree.textRanges(adapter.createTextNode('untracked')), /HTML text has no source ranges/);
  });

  test('given nested template text, supplies the same source facts', () => {
    const html = '<template><template>😀 &amp;</template></template>';
    const tree = SourceHtmlDocument.parse(html);
    const outer = tree.elements.find((element) => element.name === 'template');
    assert.ok(outer);
    const inner = adapter.getTemplateContent(outer).children.find(adapter.isElementNode);
    assert.ok(inner);
    const text = adapter.getTemplateContent(inner).children.find(adapter.isTextNode);
    assert.ok(text);
    assert.deepEqual(sourceText(html, tree.textRanges(text)), ['😀 &amp;']);
  });

  test('given mutable query results, later queries retain private ranges and decoded values', () => {
    const html = '<p style="color:red">Text</p>';
    const tree = SourceHtmlDocument.parse(html);
    const paragraph = tree.elements.find((element) => element.name === 'p');
    assert.ok(paragraph);
    const text = paragraph.children.find(adapter.isTextNode);
    assert.ok(text);
    const textRanges = tree.textRanges(text) as { start: number; end: number }[];
    textRanges[0].start = -1;
    textRanges.push({ start: 0, end: 1 });
    assert.deepEqual(sourceText(html, tree.textRanges(text)), ['Text']);
    const tags = tree.elementTagRanges(paragraph) as { start: number; end: number }[];
    tags[0].end = -1;
    tags.length = 0;
    assert.deepEqual(sourceText(html, tree.elementTagRanges(paragraph)), ['<p style="color:red">', '</p>']);
    const styles = tree.styleSources(paragraph) as { range: { start: number; end: number }; decodedValues: string[] }[];
    styles[0].range.start = -1;
    styles[0].decodedValues.push('display:none');
    styles.push({ range: { start: 0, end: 1 }, decodedValues: [] });
    const freshStyles: readonly StyleSource[] = tree.styleSources(paragraph);
    assert.deepEqual(freshStyles.map(({ decodedValues }) => decodedValues), [['color:red']]);
    assert.deepEqual(sourceText(html, freshStyles.map(({ range }) => range)), ['style="color:red"']);
  });
});
