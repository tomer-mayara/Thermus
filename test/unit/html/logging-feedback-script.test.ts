import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { loggingPage } from '../../../src/interfaces/web/account/logging-page.ts';

async function scriptSite(options: { saved?: boolean; recovery?: boolean; stored?: string | null; blockedStorage?: boolean } = {}) {
  const response = loggingPage({
    ...(options.recovery ? { notice: { title: 'Unavailable', message: 'Read saved settings.', status: 503 } } : { settings: { revision: 'r1', endpoint: 'https://collector.example/v1/logs', auth: 'bearer', enabled: false, tokenPresent: true } }),
    ...(options.saved === undefined ? {} : { saved: options.saved }), tenantId: 'tenant:a', csrfToken: 'csrf', action: '/logging/save', testAction: '/logging/test',
    navigation: { product: '/', members: '/members', organizations: '/organizations', logging: '/logging' },
  });
  const { document, window: dom } = parseHTML(await response.text());
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000 });
  const timers: { callback: () => void; delay: number }[] = [];
  const scrolls: number[][] = [];
  const writes: { key: string; value: string }[] = [];
  const removed: string[] = [];
  const script = document.querySelector('script')?.textContent;
  assert.ok(script);
  const window = {
    scrollY: 420, innerHeight: 800, scrollTo: (...args: number[]) => scrolls.push(args),
    requestAnimationFrame: (callback: () => void) => callback(),
    sessionStorage: {
      getItem: () => { if (options.blockedStorage) throw new Error('blocked storage'); return options.stored ?? null; },
      removeItem: (key: string) => { removed.push(key); },
      setItem: (key: string, value: string) => { if (options.blockedStorage) throw new Error('blocked storage'); writes.push({ key, value }); },
    },
  };
  runInNewContext(script, { document, window, Date: { now: () => 200000 }, setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); } });
  return { document, dom, timers, scrolls, writes, removed };
}

test('Given server-confirmed saved feedback, when 30 seconds pass or the Admin edits a field, then the saved text disappears', async () => {
  for (const event of ['timeout', 'input', 'change']) {
    const site = await scriptSite({ saved: true });
    const marker = site.document.querySelector('#logging-saved'); assert.ok(marker);
    assert.equal(marker.textContent, 'saved');
    const timer = site.timers.find(timer => timer.delay === 30000); assert.ok(timer);
    if (event === 'timeout') timer.callback();
    else site.document.querySelector('input[name="endpoint"]')?.dispatchEvent(new site.dom.Event(event, { bubbles: true }));
    assert.equal(marker.textContent, '');
  }
});

test('Given a valid native submit, when scroll state is recorded, then only position and time are stored for this Audit URL and native submission continues', async () => {
  const site = await scriptSite();
  const form = site.document.querySelector('form'); assert.ok(form);
  const event = new site.dom.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(site.writes.length, 1);
  assert.ok(site.writes[0].key.includes('/logging'));
  assert.deepEqual(JSON.parse(site.writes[0].value), { y: 420, at: 200000 });
});

test('Given a recent scroll position on a recovery page, when the page opens, then it is consumed once and clamped to the current page height', async () => {
  const site = await scriptSite({ recovery: true, stored: JSON.stringify({ y: 1700, at: 199999 }) });
  assert.equal(site.document.querySelector('form'), null);
  assert.deepEqual(site.scrolls, [[0, 1200]]);
  assert.equal(site.removed.length, 1);
});

test('Given expired, future, malformed, or invalid scroll state, when Audit opens, then the page does not restore it', async () => {
  for (const stored of ['{', JSON.stringify({ y: 1, at: 79999 }), JSON.stringify({ y: 1, at: 200001 }), JSON.stringify({ y: -1, at: 199999 }), JSON.stringify({ y: 'secret', at: 199999 }), JSON.stringify({ y: 1, at: '200000' })]) {
    const site = await scriptSite({ stored });
    assert.deepEqual(site.scrolls, []);
    assert.equal(site.removed.length, 1);
  }
});

test('Given blocked session storage, when Audit opens or submits, then native Save remains usable and no saved feedback is invented', async () => {
  const site = await scriptSite({ blockedStorage: true });
  const form = site.document.querySelector('form'); assert.ok(form);
  const event = new site.dom.Event('submit', { bubbles: true, cancelable: true });
  assert.doesNotThrow(() => form.dispatchEvent(event));
  assert.equal(event.defaultPrevented, false);
  assert.equal(site.document.querySelector('#logging-saved')?.textContent, '');
});
