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
const phase = process.argv[2] ?? 'green';
const proof = {
  scenario: 'Given desktop, tablet, mobile, and narrow viewports, when the real Audit page renders, then the panel fills the page content, Save and Test share a row when they fit, and Test is gray.',
  phase,
  scope: 'Chromium renders production LoggingRoutes, page, layout and stylesheet. Trusted local Admin fixture, in-memory settings store and controlled Test sender. No live writes.',
  measurements: [], failures: [], screenshots: [],
};
try {
  const saved = await service.save(tenantId, { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: 'manual-only-token', enabled: false });
  assert.equal(saved.status, 'saved');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 1024, 768, 390, 320, 240]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`${origin}/logging`);
    await page.evaluate(() => document.fonts.ready);
    const measured = await page.evaluate(() => {
      const main = document.querySelector('main');
      const panel = document.querySelector('.invite-card');
      const save = [...document.querySelectorAll('button')].find(button => button.textContent === 'Save');
      const test = [...document.querySelectorAll('button')].find(button => button.textContent === 'Test saved destination');
      const rect = element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height });
      return {
        viewport: innerWidth, main: rect(main), panel: rect(panel), header: rect(document.querySelector('.header-content')),
        save: rect(save), test: rect(test), saveBackground: getComputedStyle(save).backgroundColor, testBackground: getComputedStyle(test).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
        saveType: save.type, testType: test.type, testAction: test.getAttribute('formaction'), testNoValidate: test.formNoValidate,
      };
    });
    proof.measurements.push(measured);
    const check = (condition, message) => { if (!condition) proof.failures.push(`${width}px: ${message}`); };
    check(Math.abs(measured.panel.width - measured.header.width) < 1, 'Audit panel does not fill page content width');
    if (width >= 390) check(Math.abs(measured.save.y - measured.test.y) < 1, 'Save and Test do not share a row');
    check(measured.save.width < measured.panel.width / 2, 'Save stretches across the form');
    check(measured.testBackground === 'rgb(67, 69, 78)', 'Test lacks gray secondary background');
    check(measured.saveBackground === 'rgb(232, 85, 42)', 'Save lacks primary orange background');
    check(!measured.overflow, 'Page has horizontal overflow');
    check(measured.saveType === 'submit' && measured.testType === 'submit' && measured.testAction === '/logging/test' && measured.testNoValidate, 'Button form semantics changed');
    await page.screenshot({ path: new URL(`${phase}-${width}.png`, directory).pathname, fullPage: true });
    proof.screenshots.push(`${phase}-${width}.png`);
  }
  await page.setViewportSize({ width: 768, height: 1100 });
  await page.goto(`${origin}/members`);
  proof.membersTabletWidth = await page.locator('main').evaluate(element => element.getBoundingClientRect().width);
  if (proof.membersTabletWidth !== 650) proof.failures.push('Members tablet width changed');
  proof.browserErrors = errors;
  if (errors.length) proof.failures.push('Browser script errors occurred');
  proof.passed = proof.failures.length === 0;
  await writeFile(new URL(`${phase}.json`, directory), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
  assert.equal(proof.passed, true, proof.failures.join('\n'));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
