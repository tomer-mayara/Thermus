import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

describe('whole transform validation for typed math', () => {
  for (const sibling of [
    'scale(calc(1px))',
    'matrix(calc(1px),0,0,1,0,0)',
    'rotate(calc(1px))',
    'translateX(calc(1))',
    'translateZ(calc(10%))',
    'perspective(calc(1))',
    'skewX(calc(1px))',
  ]) {
    for (const before of [false, true]) {
      test(`keeps text with invalid ${sibling} ${before ? 'before' : 'after'} a zero scale`, async () => {
        const transform = before ? `${sibling} scale(calc(0))` : `scale(calc(0)) ${sibling}`;
        const result = await cleanBody(`<p style="transform:${transform}">Visible text</p>`);

        assert.match(result.html, /Visible text/);
        assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
        assert.deepEqual(result.found, []);
      });
    }
  }

  for (const zero of ['scale(0)', 'scaleZ(0)']) {
    test(`keeps text when ${zero} has an invalid scalar sibling`, async () => {
      const result = await cleanBody(`<p style="transform:${zero} scale(calc(1px))">Visible text</p>`);

      assert.match(result.html, /Visible text/);
      assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});

describe('invalid math declaration cascade', () => {
  for (const { name, style, rule = '', hidden } of [
    { name: 'an empty wrapper after a collapsed inline transform', hidden: true,
      style: 'transform:scale(0);transform:scale(calc())' },
    { name: 'a trailing operator after a collapsed class transform', hidden: true, style: '',
      rule: '.target{transform:scale(0);transform:scale(calc(1 +))}' },
    { name: 'a bogus wrapper after an important collapsed inline transform', hidden: true,
      style: 'transform:scale(0)!important;transform:scale(calc(bogus))!important' },
    { name: 'a bad typed important inline value over a collapsed important class', hidden: true,
      style: 'transform:scale(calc(1px))!important', rule: '.target{transform:scale(0)!important}' },
    { name: 'an invalid compound after an identity inline transform', hidden: false,
      style: 'transform:scale(1);transform:scale(calc(0)) scale(calc(1px))' },
    { name: 'an invalid inline compound over an identity class transform', hidden: false,
      style: 'transform:scale(calc(0)) scale(calc(1px))', rule: '.target{transform:scale(1)}' },
  ]) {
    test(`${hidden ? 'removes' : 'keeps'} text with ${name}`, async () => {
      const result = await cleanBody(`<p class="target" style="${style}">Target text</p>`,
        rule ? `<style>${rule}</style>` : '');

      if (hidden) assert.doesNotMatch(result.html, /Target text/);
      else assert.match(result.html, /Target text/);
      assert.equal(result.markdown, hidden ? 'Visible sibling' : 'Target text\n\nVisible sibling');
      assert.deepEqual(result.found, hidden ? ['hidden-html'] : []);
    });
  }
});

describe('unresolved siblings block independent zero proofs', () => {
  for (const factor of [
    'calc(1 + 1)', 'calc(var(--missing))', 'calc(env(missing))',
    'calc(attr(data-factor type(<number>),1))',
  ]) {
    test(`keeps text when a zero scale has the unresolved sibling scale(${factor})`, async () => {
      const result = await cleanBody(
        `<p style="transform:scale(calc(0)) scale(${factor})">Visible text</p>`,
      );

      assert.match(result.html, /Visible text/);
      assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  for (const offset of ['var(--offset)', 'env(missing)', 'attr(data-offset type(<length>),1px)']) {
    test(`keeps a winning unknown declaration containing ${offset} and a fixed bad sibling`, async () => {
      const result = await cleanBody(
        '<p style="transform:scale(0);' +
        `transform:scale(calc(1px)) translateX(${offset})">Visible text</p>`,
      );

      assert.match(result.html, /Visible text/);
      assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});

describe('valid typed siblings preserve independent singularity', () => {
  for (const sibling of [
    'scale(calc(100%))', 'matrix(calc(1),0,0,1,0,0)', 'rotate(calc(30deg))',
    'skewX(calc(30deg))', 'translateX(calc(1em))', 'perspective(calc(1em))',
  ]) {
    test(`removes text when a zero scale has valid sibling ${sibling}`, async () => {
      const result = await cleanBody(`<p style="transform:scale(calc(0)) ${sibling}">Hidden text</p>`);

      assert.doesNotMatch(result.html, /Hidden text/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }
});
