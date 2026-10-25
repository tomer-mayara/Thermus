import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formLabelled, formsIn, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedConfig, hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import type { AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import { serveDestinationTestSite, destinationTestAdmin as admin, destinationTestOrganizationId as organizationId, destinationTestEndpoint as endpoint, destinationTestSecret as secret } from '../../support/in-process/logging-destination-test-site.ts';

test('Given a current Admin and an Axiom destination, when the Admin saves its dataset, Tests, and enables export, then Test and export use the saved dataset and a dataset edit invalidates old work', async (t) => {
  const { calls, service, tenantId, site } = await serveDestinationTestSite(t);
  const { browser } = await signInThroughServer(site, admin, organizationId);
  const initial = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const axiomEndpoint = 'https://us-east-1.aws.edge.axiom.co/v1/logs';
  const visible = { endpoint: axiomEndpoint, destination: 'axiom', auth: 'bearer', token: '', axiom_dataset: 'audit-log-test' };
  const saved = await browser.submit({ ...initial, fields: { ...initial.fields, ...visible, token: secret } });
  assert.equal(saved.status, 303);
  const page = await browser.follow(saved);
  const testForm = formLabelled(formsIn(page.body), 'Test');
  assert.match(page.body, /name="axiom_dataset"[^>]*value="audit-log-test"/);
  assert.ok(!page.body.includes(secret));
  const tested = await browser.submit({ ...testForm, fields: { ...testForm.fields, ...visible } });
  assert.equal(tested.status, 200);
  assert.match(tested.body, /Destination accepted the Test event/);
  const expectedDestination = { endpoint: axiomEndpoint, auth: { type: 'bearer', token: secret }, axiomDataset: 'audit-log-test' };
  assert.deepEqual(calls.map(call => call.destination), [expectedDestination]);
  const enable = formLabelled(formsIn(page.body), 'Save');
  assert.equal((await browser.submit({ ...enable, fields: { ...enable.fields, ...visible, enabled: 'on' } })).status, 303);
  const enabled = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  assert.deepEqual(await service.authorizeExport(tenantId, enabled.fields.expected_revision), { status: 'ready', destination: expectedDestination });
  assert.equal((await browser.submit({ ...enabled, fields: { ...enabled.fields, ...visible, enabled: 'on', axiom_dataset: 'audit-next' } })).status, 303);
  assert.deepEqual(await service.authorizeExport(tenantId, enabled.fields.expected_revision), { status: 'changed' });
});


for (const config of [hostedRootConfig, hostedConfig]) {
  for (const auth of ['none', 'bearer'] as const) {
    test(`Given a current Admin and a saved disabled ${auth} destination at ${new URL(config.publicBaseUrl).pathname}, when Bearer settings are saved before Test if needed, then one synthetic event uses the saved token without Enable`, async (t) => {
      const { calls, service, tenantId, store, site } = await serveDestinationTestSite(t, { config, auth });
      const { browser } = await signInThroughServer(site, admin, organizationId);
      let page = await browser.open('logging');
      if (auth === 'none') {
        assert.match(page.body, /Enter a Bearer token to Save or Test/);
        const oldTest = formLabelled(formsIn(page.body), 'Test');
        const legacy = await service.read(tenantId);
        assert.equal((await browser.submit({ ...oldTest, fields: { ...oldTest.fields, endpoint, token: '' } })).status, 400);
        assert.deepEqual(await service.read(tenantId), legacy);
        assert.equal(calls.length, 0);
        const save = formLabelled(formsIn(page.body), 'Save');
        const upgraded = await browser.submit({ ...save, fields: { ...save.fields, endpoint, token: secret } });
        assert.equal(upgraded.status, 303);
        page = await browser.follow(upgraded);
      }
      const selected = formLabelled(formsIn(page.body), 'Test');
      const form: PageForm = { ...selected, fields: { ...selected.fields, endpoint, token: '' } };
      assert.match(form.action, /\/logging\/test$/);
      assert.equal(form.fields.organization_id, tenantId);
      assert.doesNotMatch(page.body, /formnovalidate/);
      assert.match(page.body, /Test saves these settings, then sends one synthetic event/);
      assert.match(page.body, /Test saves these settings/);
      const before = await service.read(tenantId);
      const answer = await browser.submit(form);
      assert.equal(answer.status, 200);
      assert.match(answer.body, /Destination accepted the Test event/);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0]?.destination, { endpoint, auth: { type: 'bearer', token: secret } });
      assert.equal(calls[0]?.event.eventName, 'audit.destination.test');
      assert.equal(calls[0]?.event.organizationId, tenantId);
      assert.equal(calls[0]?.event.actor.subject, admin.id);
      assert.deepEqual(await service.read(tenantId), before);
      assert.equal(store.writes, auth === 'none' ? 3 : 2);
      assert.equal(answer.headers.get('Cache-Control'), 'no-store');
      assert.ok(!answer.body.includes(secret));
      assert.ok(!site.log.lines.join('\n').includes(secret));
      assert.deepEqual(formsIn(answer.body).map(form => form.label), ['Save', 'Test']);
    });
  }
}

for (const edits of [{ endpoint: 'https://edited.example/v1/logs' }, { endpoint: '' }, { token: secret }, { enabled: 'on' }, { auth: 'none' }, { destination: 'axiom', axiom_dataset: 'unsaved-dataset' }] as Record<string, string>[]) {
  test(`Given edited ${Object.keys(edits).join(', ')} settings, when Test is selected, then valid edits save and Test while invalid edits send nothing`, async (t) => {
    const { calls, service, tenantId, store, site } = await serveDestinationTestSite(t);
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const page = await browser.open('logging');
    const selected = formLabelled(formsIn(page.body), 'Test');
    const form: PageForm = { ...selected, fields: { ...selected.fields, endpoint, token: '' } };
    const before = await service.read(tenantId);
    const answer = await browser.submit({ ...form, fields: { ...form.fields, ...edits } });
    const invalid = edits.auth === 'none' || edits.endpoint !== undefined;
    assert.equal(answer.status, invalid ? 400 : 200);
    assert.equal(calls.length, invalid ? 0 : 1);
    assert.equal(store.writes, invalid ? 1 : 2);
    const after = await service.read(tenantId);
    if (invalid || edits.token) assert.deepEqual(after, before);
    else {
      assert.ok(after.status === 'found');
      assert.equal(after.settings.enabled, edits.enabled === 'on');
      assert.equal(after.settings.axiomDataset, edits.axiom_dataset);
    }
    assert.ok(!answer.body.includes(secret));
  });
}

for (const change of ['revision', 'read-failure'] as const) {
  test(`Given a Test in progress, when the post-settlement saved ${change} changes its authority, then the browser suppresses the accepted result`, { timeout: 10000 }, async (t) => {
    let started!: () => void;
    const attempted = new Promise<void>((resolve) => { started = resolve; });
    let finish!: (outcome: AuditSendOutcome) => void;
    const pending = new Promise<AuditSendOutcome>((resolve) => { finish = resolve; });
    const { service, tenantId, store, calls, site } = await serveDestinationTestSite(t, { send: () => { started(); return pending; } });
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const page = await browser.open('logging');
    const selected = formLabelled(formsIn(page.body), 'Test');
    const form: PageForm = { ...selected, fields: { ...selected.fields, endpoint, token: '' } };
    const answerPromise = browser.submit(form);
    await attempted;
    if (change === 'revision') {
      const revision = form.fields.expected_revision; assert.ok(revision);
      await service.save(tenantId, { expectedRevision: revision, endpoint: 'https://updated.example/v1/logs', auth: 'none', token: '', enabled: false });
    } else {
      t.mock.method(store, 'read', async () => ({ status: 'unavailable' as const }));
    }
    finish({ kind: 'accepted' });
    const answer = await answerPromise;
    assert.equal(answer.status, change === 'revision' ? 409 : 503);
    assert.match(answer.body, /Test result suppressed/);
    assert.doesNotMatch(answer.body, /Destination accepted/);
    assert.match(answer.body, /Read saved settings/);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.equal(calls.length, 1);
  });
}

for (const refusal of ['origin', 'csrf', 'tenant', 'revoked-admin'] as const) {
  test(`Given a ${refusal} refusal, when the saved destination Test is submitted, then no event leaves the protected account boundary`, async (t) => {
    const { site, calls } = await serveDestinationTestSite(t);
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const page = await browser.open('logging');
    const selected = formLabelled(formsIn(page.body), 'Test');
    const form: PageForm = { ...selected, fields: { ...selected.fields, endpoint, token: '' } };
    if (refusal === 'revoked-admin') site.world.memberships = [{ userId: admin.id, organizationId, roles: ['user'] }];
    const fields = { ...form.fields, ...(refusal === 'csrf' ? { csrf_token: 'forged' } : {}), ...(refusal === 'tenant' ? { organization_id: 'workos:other:org' } : {}) };
    const answer = await browser.submit({ ...form, fields }, refusal === 'origin' ? { origin: 'https://foreign.example' } : {});
    assert.equal(answer.status, refusal === 'tenant' ? 409 : 403);
    assert.equal(calls.length, 0);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  });
}
