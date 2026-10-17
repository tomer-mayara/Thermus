import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../../fixtures/html-cleaner-context.ts';

async function cleanDocument(body: string) {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  return pipeline.process(createContext(`<!doctype html><html><body><main>${body}</main></body></html>`));
}

describe('visibility correctness regressions', () => {
  test('keeps a valid hiding transform when a later declaration has invalid raw syntax', async () => {
    const result = await cleanDocument(
      '<div style="transform:scale(0);transform:???">Hidden content</div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden content/);
    assert.match(result.html, /Visible sibling/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps content when a later transform declaration has an unresolved named variable', async () => {
    const result = await cleanDocument(
      '<div style="transform:scale(0);transform:var(--unknown)">VISIBLE CONTENT</div>' +
      '<p>Visible sibling</p>',
    );

    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a visible flat child when important parent perspective precedes a normal reset', async () => {
    const result = await cleanDocument(
      '<div style="perspective:500px!important;perspective:none;' +
      'perspective-origin:0 0;width:300px;height:200px">' +
      '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
      'VISIBLE CONTENT</div></div><p>Visible sibling</p>',
    );

    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('removes a collapsed flat child when a later important declaration resets parent perspective', async () => {
    const result = await cleanDocument(
      '<div style="perspective:500px!important;perspective:none!important;' +
      'perspective-origin:0 0;width:300px;height:200px">' +
      '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
      'Hidden content</div></div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden content/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  for (const display of ['', 'display:inline;']) {
    test(`keeps non-replaced inline span text with ${display || 'default display'}`, async () => {
      const result = await cleanDocument(
        `<p><span style="${display}transform:rotateX(45deg) rotateX(45deg)">` +
        'VISIBLE CONTENT</span></p><p>Visible sibling</p>',
      );

      assert.match(result.html, /VISIBLE CONTENT/);
      assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('removes a collapsed inline-block span', async () => {
    const result = await cleanDocument(
      '<p><span style="display:inline-block;transform:rotateX(45deg) rotateX(45deg)">' +
      'Hidden content</span></p><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden content/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('removes a collapsed inline replaced image', async () => {
    const result = await cleanDocument(
      '<p><img style="display:inline;transform:rotateX(45deg) rotateX(45deg)" ' +
      'src="/hidden.png" alt="Hidden image" width="100" height="100"></p><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /hidden.png/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  const eligibilityCases = [
    { name: 'an explicit inline div', tag: 'div', style: 'display:inline', parent: '', visible: true },
    { name: 'a default del element', tag: 'del', style: '', parent: '', visible: true },
    { name: 'a default ins element', tag: 'ins', style: '', parent: '', visible: true },
    { name: 'a default custom element', tag: 'x-inline', style: '', parent: '', visible: true },
    { name: 'an explicit block custom element', tag: 'x-inline', style: 'display:block', parent: '', visible: false },
    { name: 'important inline before normal inline-block', tag: 'span',
      style: 'display:inline!important;display:inline-block', parent: '', visible: true },
    { name: 'inline before important block', tag: 'span',
      style: 'display:inline;display:block!important', parent: '', visible: false },
    { name: 'an absolutely positioned inline span', tag: 'span',
      style: 'display:inline;position:absolute', parent: '', visible: false },
    { name: 'a floated inline span', tag: 'span', style: 'display:inline;float:left', parent: '', visible: false },
    { name: 'an inline flex child', tag: 'span', style: 'display:inline', parent: 'display:flex', visible: false },
    { name: 'a flex inline child', tag: 'span', style: 'display:inline', parent: 'display:flex inline', visible: false },
    { name: 'an inline grid child', tag: 'span', style: 'display:inline', parent: 'display:grid', visible: false },
    { name: 'an unresolved display value', tag: 'span', style: 'display:var(--box)', parent: '', visible: true },
    { name: 'display none after inline', tag: 'span', style: 'display:inline;display:none', parent: '', visible: false },
  ];
  for (const { name, tag, style, parent, visible } of eligibilityCases) {
    test(`${visible ? 'keeps' : 'removes'} a composed transform on ${name}`, async () => {
      const result = await cleanDocument(
        `<div style="${parent}"><${tag} style="${style};transform:rotateX(45deg) rotateX(45deg)">` +
        `TARGET CONTENT</${tag}></div><p>Visible sibling</p>`,
      );

      if (visible) assert.match(result.html, /TARGET CONTENT/);
      else assert.doesNotMatch(result.html, /TARGET CONTENT/);
      const visibleContent = tag === 'del' ? '~~TARGET CONTENT~~' : 'TARGET CONTENT';
      assert.equal(result.markdown, visible ? `${visibleContent}\n\nVisible sibling` : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }

  const invalidPerspectives = [
    { value: '500px!important;perspective:???', visible: true },
    { value: 'none;perspective:???', visible: false },
    { value: '500px;perspective:-1px', visible: true },
    { value: 'none;perspective:-1px', visible: false },
  ];
  for (const { value, visible } of invalidPerspectives) {
    test(`keeps the valid parent perspective in perspective:${value}`, async () => {
      const result = await cleanDocument(
        `<div style="perspective:${value};perspective-origin:0 0;width:300px;height:200px">` +
        '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
        'TARGET CONTENT</div></div><p>Visible sibling</p>',
      );

      if (visible) assert.match(result.html, /TARGET CONTENT/);
      else assert.doesNotMatch(result.html, /TARGET CONTENT/);
      assert.equal(result.markdown, visible ? 'TARGET CONTENT\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});
