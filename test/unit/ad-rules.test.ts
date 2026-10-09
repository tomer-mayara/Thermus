import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';

describe('Supplied ad rules', () => {
  test('uses supplied rules on an ordinary host and honors exceptions', async () => {
    const supplied = new CleanHtmlAdsAdblockRs([
      'example.com##.ad',
      'example.com##.keep',
      'example.com#@#.keep',
    ].join('\n'));
    const html = '<div class="ad">Ad</div><div class="keep">Keep</div><p>Content</p>';

    const result = await supplied.invoke({ url: 'https://example.com/', html, removed: 0, skipped: 0 });
    const unmatched = await supplied.invoke({ url: 'https://other.example/', html, removed: 0, skipped: 0 });

    assert.equal(result.html, '<div class="keep">Keep</div><p>Content</p>');
    assert.equal(result.removed, 1);
    assert.equal(result.skipped, 0);
    assert.equal(unmatched.html, html);
    assert.equal(unmatched.removed, 0);
  });

  test('honors generic selector exceptions and generic hiding exceptions', async () => {
    const supplied = new CleanHtmlAdsAdblockRs([
      '##.ad',
      '##.keep',
      'example.com#@#.keep',
      '@@||other.example^$generichide',
    ].join('\n'));
    const html = '<div class="ad">Ad</div><div class="keep">Keep</div><p>Content</p>';

    const result = await supplied.invoke({ url: 'https://example.com/', html, removed: 0, skipped: 0 });
    const exception = await supplied.invoke({ url: 'https://other.example/', html, removed: 0, skipped: 0 });

    assert.equal(result.html, '<div class="keep">Keep</div><p>Content</p>');
    assert.equal(result.removed, 1);
    assert.equal(exception.html, html);
    assert.equal(exception.removed, 0);
  });

  for (const order of ['ABA', 'BAB']) {
    test(`keeps supplied rules separate across ${order} instances`, async () => {
      const html = '<div class="a">A</div><div class="b">B</div><p>Content</p>';
      const instances = new Map<string, CleanHtmlAdsAdblockRs>();
      for (const label of new Set(order)) {
        instances.set(label, new CleanHtmlAdsAdblockRs(`example.com##.${label.toLowerCase()}`));
      }

      for (const label of order) {
        const cleaner = instances.get(label);
        assert.ok(cleaner);
        const result = await cleaner.invoke({ url: 'https://example.com/', html, removed: 0, skipped: 0 });

        assert.equal(result.html, label === 'A'
          ? '<div class="b">B</div><p>Content</p>'
          : '<div class="a">A</div><p>Content</p>');
        assert.equal(result.removed, 1);
        assert.equal(result.skipped, 0);
      }
    });
  }

  test('rejects a missing rule argument', () => {
    assert.throws(() => Reflect.construct(CleanHtmlAdsAdblockRs, []), {
      name: 'TypeError',
      message: 'Ad rules must be supplied as a string',
    });
  });

  for (const rules of [undefined, null, 3, false, {}, [], new String('example.com##.ad')]) {
    test(`rejects a non-string rule argument: ${String(rules)}`, () => {
      assert.throws(() => Reflect.construct(CleanHtmlAdsAdblockRs, [rules]), {
        name: 'TypeError',
        message: 'Ad rules must be supplied as a string',
      });
    });
  }

  for (const [label, rules] of [
    ['empty', ''],
    ['blank', ' \t\n\r\n'],
    ['comments', '! A comment\n! Homepage: https://rules.example/list.txt\n[Adblock Plus 2.0]'],
    ['malformed', 'example.com##\nexample.com#@#\n||example.com^$unknown-filter-option'],
  ]) {
    test(`accepts ${label} rules as a no-op`, async () => {
      const supplied = new CleanHtmlAdsAdblockRs(rules);
      const input = {
        url: 'https://abptestpages.org/',
        html: '<div id="eh-id">Ad</div><p>Content</p>',
        removed: 2,
        skipped: 3,
      };

      assert.deepEqual(await supplied.invoke(input), input);
    });
  }

  test('keeps valid rules when malformed lines are supplied', async () => {
    const supplied = new CleanHtmlAdsAdblockRs([
      'example.com##',
      'example.com##.ad',
      '||example.com^$unknown-filter-option',
      'example.com#@#',
      'example.com##.keep',
      'example.com#@#.keep',
    ].join('\n'));
    const result = await supplied.invoke({
      url: 'https://example.com/',
      html: '<div class="ad">Ad</div><div class="keep">Keep</div>',
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, '<div class="keep">Keep</div>');
    assert.equal(result.removed, 1);
    assert.equal(result.skipped, 0);
  });

  test('makes no network calls during initialization or cleaning', async (t) => {
    const requests = [
      t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); }),
      t.mock.method(http, 'request', () => { throw new Error('Unexpected HTTP request'); }),
      t.mock.method(http, 'get', () => { throw new Error('Unexpected HTTP GET'); }),
      t.mock.method(https, 'request', () => { throw new Error('Unexpected HTTPS request'); }),
      t.mock.method(https, 'get', () => { throw new Error('Unexpected HTTPS GET'); }),
    ];
    const supplied = new CleanHtmlAdsAdblockRs([
      '! Homepage: https://rules.example/list.txt',
      '! Redirect: https://rules.example/redirect.txt',
      '! Expires: 1 hour',
      'example.com##.ad',
    ].join('\n'));

    assert.throws(() => Reflect.construct(CleanHtmlAdsAdblockRs, []), TypeError);
    assert.throws(() => Reflect.construct(CleanHtmlAdsAdblockRs, [null]), TypeError);
    const unchanged = { url: 'https://example.com/', html: '<div class="ad">Ad</div>', removed: 0, skipped: 0 };
    for (const rules of ['', 'example.com##\n||example.com^$unknown-filter-option']) {
      assert.deepEqual(await new CleanHtmlAdsAdblockRs(rules).invoke(unchanged), unchanged);
    }
    const result = await supplied.invoke({
      url: 'https://example.com/',
      html: '<div class="ad">Ad</div><p>Content</p>',
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, '<p>Content</p>');
    for (const request of requests) {
      assert.equal(request.mock.callCount(), 0);
    }
  });
});
