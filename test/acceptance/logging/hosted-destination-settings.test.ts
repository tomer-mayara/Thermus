import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationTestSender } from '../../../src/logs/audit/destination-test.ts';
import { DestinationSettingsFake } from '../../support/doubles/logging/destination-settings-fake.ts';
import { formLabelled, formsIn, type HostedBrowser, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { hostedConfig, hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

const senderStub: DestinationTestSender = { send: async () => { throw new Error('Read and Save must not send.'); } };

const organizationId = 'org_LOGGING_A';
const admin = { id: 'user_LOGGING_ADMIN', email: 'admin@example.com', firstName: 'Admin' };

test('Given a password-authenticated current Admin, when the Admin opens Audit logs, then a protected Save form is available', async (t) => {
  const { browser } = await loggingSite(t);
  const page = await browser.open('logging');
  assert.equal(page.status, 200);
  assert.match(page.body, /<title>Audit logs · Thermus<\/title>/);
  assert.match(page.body, /<h1>Audit logs<\/h1>/);
  assert.match(page.body, /<h2[^>]*>Audit log destination<\/h2>/);
  assert.match(page.body, /organization.s audit logs/);
  assert.match(page.body, /Thermus system logs are internal/);
  assert.match(page.body, /Save/);
  const members = await browser.open('members');
  assert.match(members.body, /href="[^"]*logging"[^>]*>Audit logs/);
});

test('Given an Admin choosing an audit destination, when Audit logs opens, then a Bearer-only destination selector, short privacy notice and complete expandable help guide Save', async (t) => {
  const { browser, store } = await loggingSite(t);
  const page = await browser.open('logging');
  assert.equal(page.status, 200);
  assert.match(page.body, /<legend>Destination<\/legend>/);
  assert.match(page.body, /name="destination" value="axiom"/);
  assert.match(page.body, /name="destination" value="custom"/);
  assert.match(page.body, /<aside[^>]*role="note"[^>]*><p>Send organization data only if you have authority to do so\. Check destination access and retention\. Read our <a href="https:\/\/thermus.ai\/privacy\/">Privacy Policy<\/a>\.<\/p><\/aside>/);
  const document = parseHTML(page.body).document;
  const help = document.querySelector('details[data-help="audit"]');
  assert.ok(help, 'Complete Audit help must be available without scripts');
  assert.equal(help.hasAttribute('open'), false);
  assert.equal(help.querySelector('summary')?.textContent, 'Audit logs help');
  assert.equal(help.getAttribute('data-document-version'), 'hosted-audit-help-organization-removal-proposal-2026-10-26-v1');
  assert.equal(help.getAttribute('data-document-sha256'), '91c500488861110b50b01aea8cda7ba60cf5a7990e5a398a9124742b77588391');
  const canonical = await readFile('docs/legal/organization-removal-2026-10-26-proposal-v1/audit-help.md', 'utf8');
  const expected = parseHTML(`<div>${micromark(canonical)}</div>`).document.querySelector('div')?.textContent;
  assert.equal(help.querySelector('.administration-help-content')?.textContent, expected);
  assert.equal(help.querySelector('a')?.getAttribute('href'), 'https://thermus.ai/privacy/');
  assert.equal(help.querySelectorAll('form, input, script').length, 0);
  assert.equal(help.closest('form'), null);
  assert.doesNotMatch(document.querySelector('form')?.textContent ?? '', /What export includes|Settings have no backup/);
  assert.doesNotMatch(page.body, /name="auth" value="none"|Axiom dataset \(optional\)/);
  assert.equal(document.querySelectorAll('form').length, 1);
  assert.equal(store.writes, 0);
  const form = formLabelled(formsIn(page.body), 'Save');
  const saved = await browser.submit({ ...form, fields: { ...form.fields, ...destination, destination: 'axiom', axiom_dataset: 'audit-log-test', token: secret } });
  assert.equal(saved.status, 200);
  const reread = saved;
  assert.match(reread.body, /name="destination" value="axiom"[^>]*checked/);
  assert.ok(!reread.body.includes(secret));
});

for (const role of ['user', 'revoked-admin'] as const) {
  test(`Given ${role} access, when a browser opens Audit logs or submits its Save operation, then current Admin access is required`, async (t) => {
    const site = await serveWorkOSSite(t, {
      organizations: [organizationId],
      setUp: (world) => {
        world.users = [admin];
        world.memberships = [{ userId: admin.id, organizationId, roles: [role === 'user' ? 'user' : 'admin'] }];
      },
    });
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const session = await browser.open('session', { Accept: 'application/json' });
    const { csrfToken } = JSON.parse(session.body) as { csrfToken: string };
    if (role === 'revoked-admin') site.world.memberships = [{ userId: admin.id, organizationId, roles: ['user'] }];
    const page = await browser.open('logging');
    assert.equal(page.status, 403);
    const saved = await browser.post('logging/save', { endpoint: 'https://collector.example/v1/logs', auth: 'none', enabled: 'on', csrf_token: csrfToken });
    assert.equal(saved.status, 403);
    assert.match(page.headers.get('Cache-Control') ?? '', /no-store/);
    assert.match(saved.headers.get('Cache-Control') ?? '', /no-store/);
  });
}

async function loggingSite(t: TestContext, config = hostedConfig) {
  const store = new DestinationSettingsFake();
  const service = new DestinationSettingsService(store, Buffer.alloc(32, 7), senderStub);
  const otherOrganization = 'org_LOGGING_B';
  const site = await serveWorkOSSite(t, {
    config, organizations: [organizationId, otherOrganization],
    loggingStorage: { store, service, close: async () => {} },
    setUp: (world) => {
      world.users = [admin];
      world.memberships = [organizationId, otherOrganization].map((organizationId) => ({ userId: admin.id, organizationId, roles: ['admin'] }));
    },
  });
  const { browser } = await signInThroughServer(site, admin, organizationId);
  const tenantId = `workos:${site.world.settings.clientId}:${organizationId}`;
  return { site, store, service, browser, tenantId, otherOrganization };
}

async function saveForm(browser: HostedBrowser): Promise<PageForm> {
  const page = await browser.open('logging');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Cache-Control') ?? '', /no-store/);
  return formLabelled(formsIn(page.body), 'Save');
}

const destination = { endpoint: 'https://collector.example/v1/logs', auth: 'bearer', enabled: 'on' };
const secret = 'acceptance-only-private-token';

for (const config of [hostedRootConfig, hostedConfig]) {
  test(`Given a password-authenticated Admin at ${new URL(config.publicBaseUrl).pathname}, when endpoint, Bearer token, and Enable are saved together, then reread shows one saved version without the token`, async (t) => {
    const { site, browser, store, service, tenantId } = await loggingSite(t, config);
    const form = await saveForm(browser);
    assert.equal(form.fields.expected_revision, '');
    assert.equal(form.fields.auth, 'bearer');
    const saved = await browser.submit({ ...form, fields: { ...form.fields, ...destination, token: secret } });
    assert.equal(saved.status, 200);
    assert.equal(saved.location, undefined);
    assert.match(saved.headers.get('Cache-Control') ?? '', /no-store/);
    const page = saved;
    assert.equal(page.status, 200);
    assert.ok(!page.body.includes(secret));
    assert.match(page.body, /token.*(saved|present)|saved.*token/i);
    const reread = await service.read(tenantId);
    assert.ok(reread.status === 'found');
    assert.deepEqual({ endpoint: reread.settings.endpoint, auth: reread.settings.auth, enabled: reread.settings.enabled, tokenPresent: reread.settings.tokenPresent }, { ...destination, enabled: true, tokenPresent: true });
    assert.ok(!JSON.stringify(reread).includes(secret));
    assert.ok(!JSON.stringify([...store.settings.values()]).includes(secret));
    assert.ok(!site.log.lines.join('\n').includes(secret));
    assert.match(page.body, /name="token"[^>]*value=""|name="token"[^>]*>/);
    const ciphertextBefore = store.settings.get(tenantId)?.encryptedCredential;
    const currentForm = formLabelled(formsIn(page.body), 'Save');
    const unchanged = await browser.submit({ ...currentForm, fields: { ...currentForm.fields, ...destination, token: secret } });
    assert.equal(unchanged.status, 200);
    const after = await service.read(tenantId);
    assert.deepEqual(after, reread);
    assert.equal(store.settings.get(tenantId)?.encryptedCredential, ciphertextBefore);
  });
}

test('Given a saved destination and two forms, when a tenant is forged or an old revision is submitted, then neither can replace the saved destination', async (t) => {
  const { browser, service, tenantId, otherOrganization, site } = await loggingSite(t);
  const old = await saveForm(browser);
  const saved = await browser.submit({ ...old, fields: { ...old.fields, ...destination, token: secret } });
  assert.equal(saved.status, 200);
  const current = await service.read(tenantId);
  const stale = await browser.submit({ ...old, fields: { ...old.fields, endpoint: 'https://other.example/v1/logs', auth: 'bearer', token: '' } });
  assert.equal(stale.status, 409);
  const form = await saveForm(browser);
  const forged = await browser.submit({ ...form, fields: { ...form.fields, organization_id: `workos:${site.world.settings.clientId}:${otherOrganization}`, endpoint: 'https://other.example/v1/logs', auth: 'bearer', token: '' } });
  assert.equal(forged.status, 409);
  assert.deepEqual(await service.read(tenantId), current);
  const { browser: other } = await signInThroughServer(site, admin, otherOrganization);
  const otherForm = await saveForm(other);
  assert.equal(otherForm.fields.expected_revision, '');
  const otherPage = await other.open('logging');
  assert.ok(!otherPage.body.includes(destination.endpoint));
});

test('Given a protected Save form, when the origin or CSRF value is forged, then the destination stays absent', async (t) => {
  const { browser, service, tenantId } = await loggingSite(t);
  const form = await saveForm(browser);
  const fields = { ...form.fields, ...destination, token: secret };
  const foreign = await browser.submit({ ...form, fields }, { origin: 'https://attacker.example' });
  assert.equal(foreign.status, 403);
  const csrf = await browser.submit({ ...form, fields: { ...fields, csrf_token: 'forged' } });
  assert.equal(csrf.status, 403);
  for (const answer of [foreign, csrf]) {
    assert.match(answer.headers.get('Cache-Control') ?? '', /no-store/);
    assert.ok(!answer.body.includes(secret));
  }
  assert.equal((await service.read(tenantId)).status, 'absent');
});

test('Given a committed Save whose answer is lost, when the browser receives an unconfirmed outcome, then it offers a saved-state read and the old form conflicts', async (t) => {
  const { browser, store } = await loggingSite(t);
  const form = await saveForm(browser);
  store.unconfirmNextSave = true;
  const uncertain = await browser.submit({ ...form, fields: { ...form.fields, ...destination, token: secret } });
  assert.match(uncertain.body, /unconfirmed|could not confirm/i);
  assert.ok(!uncertain.body.includes(secret));
  assert.equal(formsIn(uncertain.body).filter(({ label }) => label === 'Save').length, 0);
  assert.match(uncertain.body, /href="[^"]*logging"/);
  assert.equal(store.writes, 1);
  const repeated = await browser.submit({ ...form, fields: { ...form.fields, ...destination, token: secret } });
  assert.equal(repeated.status, 409);
  assert.equal(store.writes, 1);
  const reloaded = await saveForm(browser);
  assert.notEqual(reloaded.fields.expected_revision, '');
  const resumed = await browser.submit({ ...reloaded, fields: { ...reloaded.fields, ...destination, token: '' } });
  assert.equal(resumed.status, 200);
});

test('Given a saved Axiom destination, when a browser without scripts selects Custom and clears its dataset, then the same endpoint retains the write-only token and an endpoint change needs a new token', async (t) => {
  const { browser, service, store, tenantId } = await loggingSite(t);
  const initial = await saveForm(browser);
  const saved = await browser.submit({ ...initial, fields: { ...initial.fields, ...destination, destination: 'axiom', axiom_dataset: 'audit-log-test', token: secret } });
  assert.equal(saved.status, 200);
  const current = await saveForm(browser);
  const custom = await browser.submit({ ...current, fields: { ...current.fields, ...destination, destination: 'custom', axiom_dataset: '', token: '' } });
  assert.equal(custom.status, 200);
  const reread = await service.read(tenantId);
  assert.ok(reread.status === 'found');
  assert.equal(reread.settings.axiomDataset, undefined);
  assert.equal(reread.settings.auth, 'bearer');
  assert.equal(reread.settings.tokenPresent, true);
  const page = await browser.open('logging');
  assert.match(page.body, /name="destination" value="custom"[^>]*checked/);
  assert.ok(!page.body.includes(secret));
  const form = formLabelled(formsIn(page.body), 'Save');
  for (const endpoint of ['https://changed.example/v1/logs', 'http://collector.example/v1/logs', '']) {
    const refused = await browser.submit({ ...form, fields: { ...form.fields, ...destination, endpoint, token: '' } });
    assert.equal(refused.status, 400);
    assert.deepEqual(await service.read(tenantId), reread);
  }
  assert.equal(store.writes, 2);
});

test('Given a protected destination form, when Save or Test submits a forged destination, dataset, or None authentication, then no settings or event is written', async (t) => {
  const { browser, service, store, tenantId } = await loggingSite(t);
  const form = await saveForm(browser);
  const forgedFields: readonly Readonly<Record<string, string>>[] = [
    { destination: '' }, { destination: 'unknown' },
    { destination: 'axiom' }, { destination: 'axiom', axiom_dataset: 'invalid_dataset' },
    { destination: 'custom', axiom_dataset: 'audit-log-test' }, { auth: 'none' },
  ];
  for (const changed of forgedFields) {
    for (const action of [form.action, form.action.replace(/\/save$/, '/test')]) {
      const result = await browser.submit({ ...form, action, fields: { ...form.fields, ...destination, token: secret, ...changed } });
      assert.equal(result.status, 400);
      assert.ok(!result.body.includes(secret));
    }
  }
  assert.equal(store.writes, 0);
  assert.equal((await service.read(tenantId)).status, 'absent');
});
