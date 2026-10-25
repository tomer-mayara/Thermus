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
const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), { send: async (destination) => { sent.push(destination); return { kind: 'accepted' }; } });
let routes;
let origin;
const server = createServer(async (incoming, outgoing) => {
  try {
    const path = new URL(incoming.url, origin).pathname;
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
const proof = { scope: 'Real Chromium with production LoggingRoutes, form, layout, service and credential codec; trusted local Admin fixture, in-memory store, controlled Test sender. No live customer writes.', checks: [], screenshots: [] };
const axiomUrl = 'https://us-east-1.aws.edge.axiom.co/v1/logs';
const token = 'manual-only-token';
const seed = async (axiom = true, auth = 'bearer') => {
  store.settings.clear();
  const saved = await service.save(tenantId, { expectedRevision: null, endpoint: axiomUrl, ...(axiom ? { axiomDataset: 'audit-log-test' } : {}), auth, token: auth === 'bearer' ? token : '', enabled: false });
  assert.equal(saved.status, 'saved');
};
const submit = async (page, name) => {
  const response = page.waitForResponse(r => r.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  return response;
};
try {
  await seed();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(`${origin}/logging`);
  assert.match(response.headers()['content-security-policy'], /script-src 'sha256-/);
  assert.equal(await page.getByRole('radio', { name: 'Axiom', exact: true }).isChecked(), true);
  assert.equal(await page.locator('#logging-dataset').evaluate(element => element.required && !element.disabled), true);
  assert.equal(await page.locator('[role="note"]').innerText(), 'Send organization data only if you have authority to do so. Check destination access and retention. Read our Privacy Policy.');
  assert.equal(await page.getByRole('heading', { name: 'What export includes' }).count(), 0);
  assert.equal(await page.locator('#logging-token').inputValue(), '');
  await page.locator('#logging-endpoint').fill('https://collector.example/v1/logs');
  await page.locator('#logging-token').fill('unsaved-token');
  await page.getByRole('radio', { name: 'Axiom', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('radio', { name: 'Custom', exact: true }).isChecked(), true);
  assert.equal(await page.locator('#logging-axiom-fields').isVisible(), false);
  assert.equal(await page.locator('#logging-dataset').evaluate(element => element.disabled && !element.required), true);
  assert.equal(await page.locator('form').evaluate(form => new FormData(form).has('axiom_dataset')), false);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#logging-dataset').inputValue(), 'audit-log-test');
  assert.equal(await page.locator('#logging-endpoint').inputValue(), 'https://collector.example/v1/logs');
  assert.equal(await page.locator('#logging-token').inputValue(), 'unsaved-token');
  proof.checks.push('Keyboard switching preserves edits and only Axiom submits a required dataset. Hash CSP executes without unsafe-inline.');
  await page.locator('#logging-dataset').fill('');
  assert.equal(await page.locator('form').evaluate(form => form.checkValidity()), false);
  await page.locator('#logging-dataset').fill('invalid_dataset');
  assert.equal(await page.locator('#logging-dataset').evaluate(element => element.validity.patternMismatch), true);
  await page.reload();
  for (const width of [1200, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.screenshot({ path: new URL(`axiom-${width}.png`, directory).pathname, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    proof.screenshots.push(`axiom-${width}.png`);
  }
  await page.getByRole('radio', { name: 'Custom', exact: true }).check();
  await page.screenshot({ path: new URL('custom-320.png', directory).pathname, fullPage: true });
  proof.screenshots.push('custom-320.png');
  const before = store.settings.get(tenantId);
  assert.equal((await submit(page, 'Test saved destination')).status(), 409);
  assert.equal(sent.length, 0);
  await page.goto(`${origin}/logging`);
  await page.getByRole('radio', { name: 'Custom', exact: true }).check();
  assert.equal((await submit(page, 'Save')).status(), 303);
  const custom = store.settings.get(tenantId);
  assert.equal(custom.axiomDataset, undefined);
  assert.equal(custom.encryptedCredential, before.encryptedCredential);
  assert.equal(custom.auth, 'bearer');
  assert.equal((await submit(page, 'Test saved destination')).status(), 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].axiomDataset, undefined);
  proof.checks.push('Unsaved type change refuses Test with no send. Custom Save removes dataset and retains existing endpoint-bound credential; saved Test succeeds.');
  await page.goto(`${origin}/members`);
  assert.doesNotMatch((await page.request.get(`${origin}/members`)).headers()['content-security-policy'], /script-src/);
  assert.deepEqual(errors, []);
  proof.checks.push('Members keeps default script denial; no browser script errors. 1200, 390 and 320 pixel layouts have no horizontal overflow.');
  await page.close();
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noJs.newPage();
  for (const destination of ['axiom', 'custom']) {
    store.settings.clear();
    await fallback.goto(`${origin}/logging`);
    await fallback.getByRole('radio', { name: destination === 'axiom' ? 'Axiom' : 'Custom', exact: true }).check();
    await fallback.locator('#logging-endpoint').fill(axiomUrl);
    await fallback.locator('#logging-token').fill(token);
    await fallback.locator('#logging-dataset').fill(destination === 'axiom' ? 'audit-log-test' : '');
    assert.equal((await submit(fallback, 'Save')).status(), 303);
    assert.equal(store.settings.get(tenantId).axiomDataset, destination === 'axiom' ? 'audit-log-test' : undefined);
  }
  await seed(false, 'none');
  await fallback.goto(`${origin}/logging`);
  assert.match(await fallback.locator('#logging-token-help').innerText(), /Save a Bearer token before Test/);
  const legacy = store.settings.get(tenantId);
  assert.equal((await submit(fallback, 'Test saved destination')).status(), 409);
  assert.deepEqual(store.settings.get(tenantId), legacy);
  await fallback.goto(`${origin}/logging`);
  await fallback.locator('#logging-token').fill(token);
  assert.equal((await submit(fallback, 'Save')).status(), 303);
  assert.equal(store.settings.get(tenantId).auth, 'bearer');
  proof.checks.push('JavaScript disabled: Axiom and Custom both save through native forms. Legacy None row stays unchanged on refused Test and upgrades only on explicit Bearer Save.');
  await noJs.close();
  proof.passed = true;
  await writeFile(new URL('browser-check.json', directory), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
