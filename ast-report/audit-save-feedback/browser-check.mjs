import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { LoggingRoutes } from '../../src/interfaces/web/account/logging-routes.ts';
import { membersPageLayout } from '../../src/interfaces/web/account/members-page-layout.ts';
import { DestinationSettingsService } from '../../src/logs/audit/destination-settings-service.ts';
import { DestinationSettingsFake } from '../../test/support/doubles/logging/destination-settings-fake.ts';

const directory = new URL('./', import.meta.url);
const tenantId = 'manual:selector';
const context = { user: { authority: 'manual', subject: 'admin' }, tenantId, organizationId: 'manual', grants: [], permissions: ['admin-grants:manage'] };
const session = { status: 'signed-in', user: context.user, csrfToken: 'manual-csrf', mfaCompleted: false, cookies: [], selectOrganization: async () => ({ status: 'refused', cookies: [] }) };
const store = new DestinationSettingsFake();
const sent = [];
let senderOutcome = { kind: 'accepted' };
let readsUnavailable = false;
const posts = [];
const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), { send: async (destination) => { sent.push(destination); return senderOutcome; } });
const readStore = store.read.bind(store);
store.read = async tenant => readsUnavailable ? { status: 'unavailable' } : readStore(tenant);
let routes;
let origin;
const server = createServer(async (incoming, outgoing) => {
  try {
    const path = new URL(incoming.url, origin).pathname;
    if (incoming.method === 'POST') posts.push(path);
    if (path.startsWith('/assets/') && !path.includes('..')) {
      const bytes = await readFile(new URL(`../../src/interfaces/user-portal/public${path}`, import.meta.url));
      outgoing.setHeader('Content-Type', path.endsWith('.woff2') ? 'font/woff2' : 'image/svg+xml');
      outgoing.end(bytes); return;
    }
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const request = new Request(new URL(incoming.url, origin), { method: incoming.method, headers: incoming.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
    const handler = routes.handlerFor(path);
    const response = path === '/members' ? membersPageLayout({ product: '/', members: '/members', organizations: '/organizations', logging: '/logging' }, '<h1>Members</h1>') : handler ? await handler(request, session, context) : new Response('Not found', { status: 404 });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
routes = new LoggingRoutes({ publicBaseUrl: `${origin}/`, organizationsPage: '/organizations', service });
const browser = await chromium.launch({ headless: true });
const proof = { scope: 'Real Chromium with production Audit routes/page/service/codec and native POST; trusted local Admin, in-memory store, controlled sender. No live writes.', checks: [], positions: [], screenshots: [] };
const open = async page => { await page.goto(`${origin}/logging`); await page.evaluate(() => document.fonts.ready); };
const post = async (page, button, noJs = false) => {
  const response = page.waitForResponse(answer => answer.request().method() === 'POST');
  await page.getByRole('button', { name: button, exact: true }).click();
  const answer = await response;
  await page.waitForLoadState('load');
  if (!noJs) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return answer;
};
const seed = async token => {
  store.settings.clear();
  assert.equal((await service.save(tenantId, { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', axiomDataset: 'browser-audit', auth: 'bearer', token, enabled: false })).status, 'saved');
};
const shot = async (page, name, fullPage = false) => {
  await page.screenshot({ path: new URL(`${name}.png`, directory).pathname, fullPage });
  proof.screenshots.push(`${name}.png`);
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await seed('prefix-private-token');
    await open(page);
    assert.equal(await page.locator('#logging-token').getAttribute('placeholder'), 'pref****');
    assert.equal(await page.locator('#logging-token').inputValue(), '');
    for (const button of ['Save', 'Test']) {
      await page.getByRole('button', { name: button, exact: true }).scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => scrollY);
      const response = await post(page, button);
      assert.equal(response.status(), 200);
      const after = await page.evaluate(() => scrollY);
      assert.ok(Math.abs(after - before) <= 1, `${button} at ${width}: ${before} -> ${after}`);
      assert.equal(await page.locator('#logging-saved').innerText(), 'saved');
      assert.equal(await page.locator('#logging-saved').isVisible(), true);
      assert.equal(await page.locator('#logging-token').inputValue(), '');
      assert.equal(await page.locator('#logging-token').getAttribute('placeholder'), 'pref****');
      assert.equal(await page.locator('form').evaluate(form => new FormData(form).get('token')), '');
      const bounds = await page.locator('#logging-saved').boundingBox(); assert.ok(bounds && bounds.y >= 0 && bounds.y < 900);
      if (button === 'Test') {
        const result = await page.locator('.logging-result').boundingBox(); assert.ok(result && result.y >= 0 && result.y < 900);
        assert.match(await page.locator('.logging-result').innerText(), /Settings saved\. Destination accepted/);
      }
      assert.equal(await page.evaluate(() => sessionStorage.getItem('thermus:audit-scroll:' + new URL('/logging', location.origin).href)), null);
      proof.positions.push({ width, button, before, after });
      await shot(page, `${button.toLowerCase()}-${width}-viewport`);
      const buttonBefore = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
      await page.clock.fastForward(30000);
      assert.equal(await page.locator('#logging-saved').innerText(), '');
      const buttonAfter = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
      assert.ok(Math.abs(buttonBefore.y - buttonAfter.y) <= 1);
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - after) <= 1);
    }
  }
  proof.checks.push('Save and Test preserve native POST scroll at1440/390/320; saved and Test outcome are visible near actions; confirmed text expires after30seconds without changing action position; placeholder remains prefix-only and value/FormData stay blank.');
  await page.setViewportSize({ width: 1440, height: 900 });
  await post(page, 'Save');
  await page.locator('#logging-token').fill('next-private-token');
  assert.equal(await page.locator('#logging-saved').innerText(), '');
  const response = await post(page, 'Save'); assert.equal(response.status(), 200);
  assert.equal(await page.locator('#logging-token').getAttribute('placeholder'), 'next****');
  assert.equal(await page.locator('#logging-token').inputValue(), '');
  assert.equal(await page.locator('#logging-saved').innerText(), 'saved');
  await page.getByRole('switch', { name: 'Enable export', exact: true }).check();
  assert.equal(await page.locator('#logging-saved').innerText(), '');
  proof.checks.push('Typing replacement text clears saved feedback and replaces the stored token; next response shows its new prefix. Changing Enable export also clears the old feedback.');
  senderOutcome = { kind: 'permanent_failure', reason: 'http_status', statusCode: 401 };
  await page.getByRole('button', { name: 'Test', exact: true }).scrollIntoViewIfNeeded();
  const failedBefore = await page.evaluate(() => scrollY);
  assert.equal((await post(page, 'Test')).status(), 502);
  assert.equal(await page.locator('#logging-saved').innerText(), 'saved');
  assert.match(await page.locator('.logging-result').innerText(), /Settings saved\. The Test attempt failed/);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - failedBefore) <= 1);
  await shot(page, 'test-failed-viewport');
  senderOutcome = { kind: 'accepted' };
  store.unconfirmNextSave = true;
  await page.locator('#logging-token').fill('uncertain-private-token');
  assert.equal((await post(page, 'Save')).status(), 503);
  assert.equal(await page.locator('form').count(), 0);
  assert.equal(await page.locator('#logging-saved').count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Read saved settings', exact: true }).count(), 1);
  await shot(page, 'save-unconfirmed-viewport');
  await page.getByRole('link', { name: 'Read saved settings', exact: true }).click();
  assert.equal(await page.locator('#logging-saved').innerText(), '');
  proof.checks.push('Test failure still confirms its preceding Save without scrolling up. Unconfirmed Save never invents saved feedback or a retryable form; explicit GET recovery does not repeat saved feedback.');
  for (const token of ['a', 'abcd', 'abcde']) {
    await seed(token); await open(page);
    assert.equal(await page.locator('#logging-token').getAttribute('placeholder'), token.length <= 4 ? '****' : 'abcd****');
    assert.equal(await page.locator('#logging-token').inputValue(), '');
    assert.equal(Object.hasOwn(store.settings.get(tenantId), 'tokenPreview'), false);
  }
  const fallback = await browser.newContext({ javaScriptEnabled: false });
  const noJs = await fallback.newPage();
  await open(noJs);
  assert.equal((await post(noJs, 'Save', true)).status(), 200);
  assert.equal(await noJs.locator('#logging-saved').innerText(), 'saved');
  assert.equal(await noJs.locator('#logging-token').inputValue(), '');
  assert.equal(await noJs.locator('#logging-token').getAttribute('placeholder'), 'abcd****');
  await fallback.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  const blockedPage = await blocked.newPage();
  blockedPage.on('pageerror', error => errors.push(error.message));
  await open(blockedPage);
  assert.equal((await post(blockedPage, 'Save')).status(), 200);
  assert.equal(await blockedPage.locator('#logging-saved').innerText(), 'saved');
  await blocked.close();
  proof.checks.push('Tokens up to4characters show only****; longer token shows onlyfirst4+****; no preview field is persisted. Native Save with scripts disabled and with blocked storage remains usable.');
  assert.deepEqual(errors, []);
  proof.passed = true;
  await writeFile(new URL('browser-check.json', directory), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
