import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

type VisibilityCase = {
  name: string;
  styles: string;
  hiddenElement: string;
  visibleElement: string;
  hiddenText: string;
  visibleText: string;
};

const visibilityCases: VisibilityCase[] = [
  {
    name: 'keeps the earlier important inline declaration',
    styles: '',
    hiddenElement: '<p style="display:none!important;display:block">Hidden display payload</p>',
    visibleElement: '<p style="display:block!important;display:none">Visible display control</p>',
    hiddenText: 'Hidden display payload',
    visibleText: 'Visible display control',
  },
  {
    name: 'uses the last declaration when importance is equal',
    styles: '',
    hiddenElement: '<p style="display:block;display:none">Hidden last declaration</p>',
    visibleElement: '<p style="display:none;display:block">Visible last declaration control</p>',
    hiddenText: 'Hidden last declaration',
    visibleText: 'Visible last declaration control',
  },
  {
    name: 'ignores invalid important declarations when resolving inline fallbacks',
    styles: '',
    hiddenElement: '<p style="display:bogus!important;display:none">Hidden invalid priority payload</p>',
    visibleElement: '<p style="display:bogus!important;display:block">Visible invalid priority control</p>',
    hiddenText: 'Hidden invalid priority payload',
    visibleText: 'Visible invalid priority control',
  },
  {
    name: 'recognizes uppercase offscreen pixel units',
    styles: '',
    hiddenElement: '<p style="position:absolute;left:-9999PX">Hidden uppercase offset</p>',
    visibleElement: '<p style="position:absolute;left:10PX">Visible ordinary offset</p>',
    hiddenText: 'Hidden uppercase offset',
    visibleText: 'Visible ordinary offset',
  },
  {
    name: 'recognizes escaped offscreen pixel units',
    styles: '',
    hiddenElement: '<p style="position:absolute;left:-9999\\50 X">Hidden escaped offset</p>',
    visibleElement: '<p style="position:absolute;left:10px">Visible escaped offset control</p>',
    hiddenText: 'Hidden escaped offset',
    visibleText: 'Visible escaped offset control',
  },
  {
    name: 'recognizes escaped zero scale transforms',
    styles: '',
    hiddenElement: `<p style="${String.raw`transform:\73 cale(0)`}">Hidden zero scale</p>`,
    visibleElement: `<p style="${String.raw`transform:\73 cale(1);left:10px`}">Visible scale and offset control</p>`,
    hiddenText: 'Hidden zero scale',
    visibleText: 'Visible scale and offset control',
  },
  {
    name: 'recognizes escaped zero opacity filters',
    styles: '',
    hiddenElement: `<p style="${String.raw`filter:\6f pacity(0)`}">Hidden zero opacity</p>`,
    visibleElement: `<p style="${String.raw`filter:\6f pacity(1);left:10px`}">Visible opacity and offset control</p>`,
    hiddenText: 'Hidden zero opacity',
    visibleText: 'Visible opacity and offset control',
  },
  {
    name: 'applies embedded class rules only to matching elements',
    styles: '.payload { display: none; }',
    hiddenElement: '<p class="payload">Hidden matching class payload</p>',
    visibleElement: '<p class="other">Visible nonmatching class control</p>',
    hiddenText: 'Hidden matching class payload',
    visibleText: 'Visible nonmatching class control',
  },
  {
    name: 'uses stylesheet source order for equal specificity',
    styles: '.payload { display: block; } .payload { display: none; }',
    hiddenElement: '<p class="payload">Hidden later stylesheet rule</p>',
    visibleElement: '<p class="other">Visible nonmatching source order control</p>',
    hiddenText: 'Hidden later stylesheet rule',
    visibleText: 'Visible nonmatching source order control',
  },
  {
    name: 'uses selector specificity across stylesheet source order',
    styles: '#payload { display: block; } .payload { display: none; }',
    hiddenElement: '<p class="payload">Hidden less specific selector target</p>',
    visibleElement: '<p id="payload" class="payload">Visible specific selector control</p>',
    hiddenText: 'Hidden less specific selector target',
    visibleText: 'Visible specific selector control',
  },
  {
    name: 'uses importance and specificity across stylesheet rules',
    styles: '#payload { display: block !important; } .payload { display: none !important; }',
    hiddenElement: '<p class="payload">Hidden important class target</p>',
    visibleElement: '<p id="payload" class="payload">Visible important specificity control</p>',
    hiddenText: 'Hidden important class target',
    visibleText: 'Visible important specificity control',
  },
  {
    name: 'lets inline normal declarations override stylesheet normal declarations',
    styles: '.payload { display: none; }',
    hiddenElement: '<p class="payload">Hidden stylesheet target</p>',
    visibleElement: '<p class="payload" style="display:block">Visible inline override control</p>',
    hiddenText: 'Hidden stylesheet target',
    visibleText: 'Visible inline override control',
  },
  {
    name: 'lets stylesheet important declarations override hidden inline declarations',
    styles: '.payload { display: block !important; }',
    hiddenElement: '<p class="payload" style="display:none!important">Hidden inline important control</p>',
    visibleElement: '<p class="payload" style="display:none">Visible important stylesheet override</p>',
    hiddenText: 'Hidden inline important control',
    visibleText: 'Visible important stylesheet override',
  },
];


function createDocument(testCase: VisibilityCase): string {
  return [
    '<!doctype html>',
    '<html><head><title>Visibility test</title><style>',
    testCase.styles,
    '</style></head><body><main>',
    testCase.hiddenElement,
    testCase.visibleElement,
    '<p>Visible main content</p>',
    '</main></body></html>',
  ].join('');
}


describe('supported CSS visibility rules', () => {
  for (const testCase of visibilityCases) {
    test(testCase.name, async () => {
      const result = await createPipeline().process(
        'https://example.com/visibility',
        createDocument(testCase),
      );
      const markdown = result.markdown ?? '';

      assert.match(result.html, /Visible main content/);
      assert.match(markdown, /Visible main content/);
      assert.ok(result.html.includes(testCase.visibleText), testCase.visibleText);
      assert.ok(markdown.includes(testCase.visibleText), testCase.visibleText);
      assert.ok(!result.html.includes(testCase.hiddenText), testCase.hiddenText);
      assert.ok(!markdown.includes(testCase.hiddenText), testCase.hiddenText);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 1);
    });
  }
});
