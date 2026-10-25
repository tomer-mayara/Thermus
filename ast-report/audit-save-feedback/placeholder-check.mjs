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
const phase = process.argv[2] ?? 'after';
try {
  await service.save(tenantId, { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', axiomDataset: 'browser-audit', auth: 'bearer', token: 'prefix-private-token', enabled: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${origin}/logging`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#logging-token').scrollIntoViewIfNeeded();
  const measured = await page.locator('#logging-token').evaluate(input => ({
    color: getComputedStyle(input, '::placeholder').color,
    opacity: getComputedStyle(input, '::placeholder').opacity,
    background: getComputedStyle(input).backgroundColor,
    fontSize: getComputedStyle(input).fontSize,
    value: input.value, placeholder: input.placeholder,
  }));
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(measured.color), luminance(measured.background)].sort((a, b) => b - a);
  const report = { phase, ...measured, contrast: (values[0] + 0.05) / (values[1] + 0.05), scope: 'Production Audit page in Chromium; local trusted Admin/store fixture; empty password value and stored-prefix placeholder.' };
  await page.screenshot({ path: new URL(`placeholder-${phase}-1440.png`, directory).pathname });
  await writeFile(new URL(`placeholder-${phase}.json`, directory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (phase === 'after') {
    assert.equal(report.color, 'rgb(180, 186, 192)');
    assert.equal(report.opacity, '1');
    assert.ok(report.contrast >= 4.5);
    assert.equal(report.value, '');
  }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
