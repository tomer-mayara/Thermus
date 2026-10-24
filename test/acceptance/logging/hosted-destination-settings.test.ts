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
    assert.equal(form.fields.auth, 'none');
    const saved = await browser.submit({ ...form, fields: { ...form.fields, ...destination, token: secret } });
    assert.equal(saved.status, 303);
    assert.equal(saved.location?.pathname, `${new URL(config.publicBaseUrl).pathname.replace(/\/$/, '')}/logging`);
    assert.match(saved.headers.get('Cache-Control') ?? '', /no-store/);
    const page = await browser.follow(saved);
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
    assert.equal(unchanged.status, 303);
    const after = await service.read(tenantId);
    assert.deepEqual(after, reread);
    assert.equal(store.settings.get(tenantId)?.encryptedCredential, ciphertextBefore);
  });
}

test('Given a saved destination and two forms, when a tenant is forged or an old revision is submitted, then neither can replace the saved destination', async (t) => {
  const { browser, service, tenantId, otherOrganization, site } = await loggingSite(t);
  const old = await saveForm(browser);
  const saved = await browser.submit({ ...old, fields: { ...old.fields, ...destination, token: secret } });
  assert.equal(saved.status, 303);
  const current = await service.read(tenantId);
  const stale = await browser.submit({ ...old, fields: { ...old.fields, endpoint: 'https://other.example/v1/logs', auth: 'none', token: '' } });
  assert.equal(stale.status, 409);
  const form = await saveForm(browser);
  const forged = await browser.submit({ ...form, fields: { ...form.fields, organization_id: `workos:${site.world.settings.clientId}:${otherOrganization}`, endpoint: 'https://other.example/v1/logs', auth: 'none', token: '' } });
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
  assert.equal(resumed.status, 303);
});
