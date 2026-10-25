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
const posts = [];
const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), { send: async (destination) => { sent.push(destination); return { kind: 'accepted' }; } });
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
const phase = process.argv[2] ?? 'green';
const proof = {
  phase,
  scenario: 'Given saved on/off export settings, when an Admin uses pointer, label, or Space to change the switch, then its visible and accessible state follows native checkbox values, sends no request until Save, and persists after Save with or without JavaScript.',
  scope: 'Real Chromium, production LoggingRoutes/page/layout/service, local trusted Admin, in-memory store, controlled sender; no live writes.',
  failures: [], checks: [], screenshots: [], responsive: [],
};
const check = (condition, message) => { if (!condition) proof.failures.push(message); };
const seed = async enabled => {
  store.settings.clear();
  assert.equal((await service.save(tenantId, { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: 'manual-only-token', enabled })).status, 'saved');
};
const inspect = async (page, expected, context) => {
  const input = page.locator('input[name="enabled"]');
  const label = input.locator('..');
  const value = await input.isChecked();
  check(value === expected, `${context}: checked state`);
  check(await page.getByRole('switch', { name: 'Enable export', exact: true }).count() === 1, `${context}: accessible role/name is not Enable export switch`);
  const text = await label.innerText();
  check(new RegExp(`\\b${expected ? 'On' : 'Off'}\\b`).test(text), `${context}: visible On/Off state is absent or wrong`);
  const serialized = await page.locator('form').evaluate(form => new FormData(form).getAll('enabled'));
  check(JSON.stringify(serialized) === JSON.stringify(expected ? ['on'] : []), `${context}: native form serialization changed`);
  check(await input.getAttribute('type') === 'checkbox', `${context}: native checkbox type changed`);
  proof.checks.push({ context, checked: value, visibleLabel: text, enabledValues: serialized, accessibility: await label.ariaSnapshot() });
};
try {
  const errors = [];
  for (const javaScriptEnabled of [true, false]) {
    const browserContext = await browser.newContext({ javaScriptEnabled, viewport: { width: 1440, height: 1100 } });
    const page = await browserContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const initial of [false, true]) {
      await seed(initial);
      await page.goto(`${origin}/logging`);
      await page.evaluate(() => document.fonts.ready);
      const prefix = `${javaScriptEnabled ? 'JS' : 'no-JS'} initial ${initial ? 'On' : 'Off'}`;
      const input = page.locator('input[name="enabled"]');
      const label = input.locator('..');
      await inspect(page, initial, prefix);
      const before = posts.length;
      await input.click();
      await inspect(page, !initial, `${prefix} pointer`);
      await label.getByText('Enable export', { exact: true }).click();
      await inspect(page, initial, `${prefix} label`);
      await input.focus();
      await page.keyboard.press('Space');
      await inspect(page, !initial, `${prefix} Space`);
      const focused = await input.evaluate(element => {
        const track = element.nextElementSibling;
        return { active: document.activeElement === element, outline: track ? getComputedStyle(track).outlineStyle : 'none', outlineWidth: track ? getComputedStyle(track).outlineWidth : '0px' };
      });
      if (javaScriptEnabled) {
        await page.screenshot({ path: new URL(`${phase}-focus-${initial ? 'off' : 'on'}.png`, directory).pathname, fullPage: true });
        proof.screenshots.push(`${phase}-focus-${initial ? 'off' : 'on'}.png`);
      }
      check(focused.active && focused.outline !== 'none' && parseFloat(focused.outlineWidth) >= 2, `${prefix}: switch has no visible keyboard focus`);
      check(posts.length === before, `${prefix}: toggle sent a request before Save`);
      check(store.settings.get(tenantId).enabled === initial, `${prefix}: toggle wrote before Save`);
      const response = page.waitForResponse(answer => answer.request().method() === 'POST');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      check((await response).status() === 303, `${prefix}: Save failed`);
      await page.waitForURL(`${origin}/logging`);
      check(posts.length === before + 1, `${prefix}: Save submitted more than once`);
      check(store.settings.get(tenantId).enabled === !initial, `${prefix}: Save did not persist switch`);
      await page.reload();
      await inspect(page, !initial, `${prefix} saved/reloaded`);
      if (javaScriptEnabled) {
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 1100 });
          await page.screenshot({ path: new URL(`${phase}-${initial ? 'off' : 'on'}-${width}.png`, directory).pathname, fullPage: true });
          proof.screenshots.push(`${phase}-${initial ? 'off' : 'on'}-${width}.png`);
          const measurement = await page.evaluate(() => {
            const input = document.querySelector('input[name="enabled"]');
            const box = input.parentElement.getBoundingClientRect();
            return { viewport: innerWidth, switchLabelWidth: box.width, switchLabelHeight: box.height, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, panelWidth: document.querySelector('.invite-card').getBoundingClientRect().width };
          });
          proof.responsive.push(measurement);
          check(!measurement.horizontalOverflow && measurement.switchLabelHeight >= 44, `${width}px: overflow or undersized switch click target`);
        }
        await page.setViewportSize({ width: 1440, height: 1100 });
      }
    }
    await browserContext.close();
  }
  proof.errors = errors;
  check(errors.length === 0, 'Browser script errors');
  check(sent.length === 0, 'Toggle or Save sent a Test event');
  proof.passed = proof.failures.length === 0;
  await writeFile(new URL(`${phase}.json`, directory), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
  assert.equal(proof.passed, true, proof.failures.join('\n'));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
