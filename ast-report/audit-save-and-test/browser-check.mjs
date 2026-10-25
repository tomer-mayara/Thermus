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
const proof = {
  scope: 'Real Chromium with production routes, form, layout, settings service and credential codec; trusted local Admin, in-memory store and controlled Test sender. No live customer writes.',
  checks: [], screenshots: [],
};
const submit = async (page, name) => {
  const answer = page.waitForResponse(response => response.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  const response = await answer;
  await page.waitForLoadState('load');
  return response;
};
const assertStyled = async (page, role, expectedText) => {
  assert.equal(await page.title(), 'Audit logs · Thermus');
  assert.equal(await page.getByRole('heading', { name: 'Audit logs', exact: true }).isVisible(), true);
  assert.equal(await page.locator('.site-header').isVisible(), true);
  assert.match(await page.getByRole(role).innerText(), expectedText);
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(23, 24, 29)');
};
const snapshot = async (page, name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(`${name}.png`, directory).pathname, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  proof.screenshots.push(`${name}.png`);
};
try {
  const errors = [];
  for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 1440, height: 1100 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const enabled of [false, true]) {
      store.settings.clear();
      const beforeWrites = store.writes; const beforeSends = sent.length; const beforePosts = posts.length;
      await page.goto(`${origin}/logging`);
      assert.equal(await page.locator('input[name="expected_revision"]').inputValue(), '');
      await page.getByRole('radio', { name: 'Axiom', exact: true }).check();
      await page.locator('#logging-dataset').fill('browser-audit');
      await page.locator('#logging-endpoint').fill('https://edited.example/v1/logs');
      await page.locator('#logging-token').fill('browser-only-private-token');
      if (enabled) await page.getByRole('switch', { name: 'Enable export', exact: true }).check();
      assert.equal(posts.length, beforePosts);
      const response = await submit(page, 'Test');
      assert.equal(response.status(), 200);
      await assertStyled(page, 'status', /Settings saved\. Destination accepted the Test event/);
      assert.equal(store.writes, beforeWrites + 1);
      assert.equal(sent.length, beforeSends + 1);
      assert.equal(posts.length, beforePosts + 1);
      assert.equal(store.settings.get(tenantId).enabled, enabled);
      assert.equal(sent.at(-1).endpoint, 'https://edited.example/v1/logs');
      assert.equal(sent.at(-1).axiomDataset, 'browser-audit');
      assert.equal(await page.locator('#logging-token').inputValue(), '');
      assert.equal(await page.getByRole('switch', { name: 'Enable export', exact: true }).isChecked(), enabled);
      assert.equal(await page.locator('input[name="expected_revision"]').inputValue(), store.settings.get(tenantId).revision);
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Test', exact: true }).count(), 1);
      assert.equal((await page.content()).includes('browser-only-private-token'), false);
      const revision = store.settings.get(tenantId).revision;
      assert.equal((await submit(page, 'Test')).status(), 200);
      assert.equal(store.settings.get(tenantId).revision, revision);
      if (javaScriptEnabled) {
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 1100 });
          await snapshot(page, `accepted-${enabled ? 'on' : 'off'}-${width}`);
        }
        await page.setViewportSize({ width: 1440, height: 1100 });
      }
      proof.checks.push(`${javaScriptEnabled ? 'JS' : 'no-JS'} export ${enabled ? 'On' : 'Off'}: first Test saves current Axiom form once, sends once, returns styled result/fresh revision/blank token; second unchanged Test retains revision.`);
    }
    senderOutcome = { kind: 'permanent_failure', reason: 'http_status', statusCode: 401 };
    await page.locator('#logging-token').fill('replacement-private-token');
    const failed = await submit(page, 'Test');
    assert.equal(failed.status(), 502);
    await assertStyled(page, 'alert', /Settings saved\. The Test attempt failed/);
    assert.equal(await page.locator('#logging-token').inputValue(), '');
    assert.equal((await page.content()).includes('replacement-private-token'), false);
    assert.equal((await page.getByRole('alert').innerText()).includes('401'), false);
    if (javaScriptEnabled) await snapshot(page, 'test-failed-1440');
    senderOutcome = { kind: 'accepted' };
    const beforeInvalid = sent.length;
    await page.locator('#logging-endpoint').fill('https://private-user:private-endpoint-secret@collector.example/v1/logs');
    assert.equal((await submit(page, 'Test')).status(), 400);
    await assertStyled(page, 'alert', /No settings were saved\. No Test was sent/);
    assert.equal(sent.length, beforeInvalid);
    assert.equal(await page.locator('#logging-endpoint').inputValue(), 'https://edited.example/v1/logs');
    assert.equal((await page.content()).includes('private-endpoint-secret'), false);
    if (javaScriptEnabled) await snapshot(page, 'invalid-save-1440');
    store.unconfirmNextSave = true;
    await page.locator('#logging-token').fill('uncertain-private-token');
    const beforeUnconfirmed = sent.length;
    assert.equal((await submit(page, 'Test')).status(), 503);
    await assertStyled(page, 'alert', /Save result is unconfirmed/);
    assert.equal(await page.locator('form').count(), 0);
    assert.equal(sent.length, beforeUnconfirmed);
    assert.equal(await page.getByRole('link', { name: 'Read saved settings', exact: true }).count(), 1);
    assert.equal((await page.content()).includes('uncertain-private-token'), false);
    if (javaScriptEnabled) await snapshot(page, 'save-unconfirmed-1440');
    await page.getByRole('link', { name: 'Read saved settings', exact: true }).click();
    assert.equal(await page.locator('input[name="expected_revision"]').inputValue(), store.settings.get(tenantId).revision);
    readsUnavailable = true;
    await page.goto(`${origin}/logging`);
    await assertStyled(page, 'alert', /settings are unavailable/);
    assert.equal(await page.locator('form').count(), 0);
    if (javaScriptEnabled) await snapshot(page, 'read-unavailable-1440');
    readsUnavailable = false;
    proof.checks.push(`${javaScriptEnabled ? 'JS' : 'no-JS'}: failed Test confirms saved settings and keeps form; invalid Save reflects no credential; uncertain Save never Tests and has styled read-only recovery; read failure stays in Audit chrome with no empty revision form.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  proof.passed = true;
  await writeFile(new URL('browser-check.json', directory), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
