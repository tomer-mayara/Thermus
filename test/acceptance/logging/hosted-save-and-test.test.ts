import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { serveDestinationTestSite, destinationTestAdmin as admin, destinationTestOrganizationId as organizationId, destinationTestEndpoint as endpoint, destinationTestSecret as secret } from '../../support/in-process/logging-destination-test-site.ts';

for (const enabled of [false, true]) {
  test(`Given edited Axiom settings with export ${enabled ? 'On' : 'Off'}, when an Admin selects Test, then one Save precedes Test and the styled settings page shows the result and saved revision`, async (t) => {
    const { calls, service, tenantId, store, site } = await serveDestinationTestSite(t);
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const page = await browser.open('logging');
    const testForm = formsIn(page.body).find(form => form.action.endsWith('/logging/test'));
    assert.ok(testForm);
    const editedEndpoint = 'https://edited.example/v1/logs';
    const edited = { ...testForm.fields, destination: 'axiom', axiom_dataset: 'audit-next', endpoint: editedEndpoint, token: secret, ...(enabled ? { enabled: 'on' } : {}) };
    const result = await browser.submit({ ...testForm, fields: edited });
    assert.equal(result.status, 200);
    assert.equal(testForm.label, 'Test');
    assert.match(result.body, /<title>Audit logs · Thermus<\/title>/);
    assert.match(result.body, /class="site-header"/);
    assert.match(result.body, /role="status"/);
    assert.match(result.body, /Settings saved/);
    assert.match(result.body, /Destination accepted the Test event/);
    assert.ok(!result.body.includes(secret));
    const current = await service.read(tenantId);
    assert.ok(current.status === 'found');
    assert.equal(current.settings.endpoint, editedEndpoint);
    assert.equal(current.settings.axiomDataset, 'audit-next');
    assert.equal(current.settings.enabled, enabled);
    assert.notEqual(current.settings.revision, testForm.fields.expected_revision);
    const resumed = formLabelled(formsIn(result.body), 'Save');
    assert.equal(resumed.fields.expected_revision, current.settings.revision);
    assert.equal(formLabelled(formsIn(result.body), 'Test').action, testForm.action);
    assert.equal(store.writes, 2);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].destination, { endpoint: editedEndpoint, axiomDataset: 'audit-next', auth: { type: 'bearer', token: secret } });
    assert.equal(calls[0].event.eventName, 'audit.destination.test');
    assert.equal(calls[0].event.destinationRevision, current.settings.revision);
    const stale = await browser.submit({ ...testForm, fields: { ...edited, endpoint } });
    assert.equal(stale.status, 409);
    assert.equal(formLabelled(formsIn(stale.body), 'Save').fields.expected_revision, current.settings.revision);
    assert.equal(calls.length, 1);
    assert.deepEqual(await service.read(tenantId), current);
  });
}

interface TestFailure {
  readonly status: number;
  readonly saveUnknown: boolean;
  readonly testFails: boolean;
  readonly arrange: (fields: Record<string, string>, site: Awaited<ReturnType<typeof testFormSite>>, t: TestContext) => void;
}

const testFailures: Readonly<Record<string, TestFailure>> = {
  invalid: { status: 400, saveUnknown: false, testFails: false, arrange: (fields) => { fields.endpoint = 'https://private-user:private-endpoint-secret@collector.example/v1/logs'; } },
  'endpoint-token': { status: 400, saveUnknown: false, testFails: false, arrange: (fields) => { fields.endpoint = 'https://changed.example/v1/logs'; } },
  unconfirmed: { status: 503, saveUnknown: true, testFails: false, arrange: (fields, { store }) => { store.unconfirmNextSave = true; fields.token = 'new-private-token'; } },
  'test-failed': { status: 502, saveUnknown: false, testFails: true, arrange: () => {} },
  'read-failed': {
    status: 503, saveUnknown: true, testFails: false, arrange: (fields, { service }, t) => {
      fields.endpoint = 'http://collector.example/v1/logs';
      t.mock.method(service, 'read', async () => { throw new Error('private-storage-cause'); });
    },
  },
};

for (const [failure, expected] of Object.entries(testFailures)) {
  test(`Given ${failure} during Test, when the Admin submits current settings, then a styled outcome distinguishes Save from Test and offers safe recovery`, async (t) => {
    const site = await testFormSite(t, expected.testFails);
    const { browserSite, browser, service, tenantId, calls, form } = site;
    const before = await service.read(tenantId);
    const fields = { ...form.fields, endpoint, token: '' };
    expected.arrange(fields, site, t);
    const answer = await browser.submit({ ...form, fields });
    assert.equal(answer.status, expected.status);
    assert.match(answer.body, /class="site-header"/);
    assert.match(answer.body, /<h1>Audit logs<\/h1>/);
    assert.match(answer.body, /role="alert"/);
    assert.doesNotMatch(answer.body, /new-private-token|private-storage-cause|private-sender-cause|private-user|private-endpoint-secret/);
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    if (expected.saveUnknown) {
      assert.equal(formsIn(answer.body).length, 0);
      assert.match(answer.body, /Read saved settings/);
    } else {
      const resumed = formLabelled(formsIn(answer.body), 'Save');
      assert.ok(before.status === 'found');
      assert.equal(resumed.fields.expected_revision, before.settings.revision);
    }
    if (expected.testFails) {
      assert.match(answer.body, /Settings saved/);
      assert.match(answer.body, /Test attempt failed/);
      assert.equal(calls.length, 1);
      assert.match(answer.body, /id="logging-saved">saved/);
    } else {
      assert.match(answer.body, /No Test was sent/);
      assert.doesNotMatch(answer.body, /id="logging-saved">saved/);
      assert.equal(calls.length, 0);
    }
    assert.doesNotMatch(browserSite.log.lines.join('\n'), /private-storage-cause|private-sender-cause|private-user|private-endpoint-secret/);
  });
}

test('Given no destination, when Test receives the first valid form, then it saves one disabled destination and tests its new version', async (t) => {
  const { browser, service, store, tenantId, calls, form } = await testFormSite(t);
  store.settings.clear();
  const first = formLabelled(formsIn((await browser.open('logging')).body), 'Test');
  assert.equal(first.fields.expected_revision, '');
  const writes = store.writes;
  const answer = await browser.submit({ ...first, fields: { ...first.fields, endpoint, token: secret } });
  assert.equal(answer.status, 200);
  const current = await service.read(tenantId);
  assert.ok(current.status === 'found');
  assert.equal(current.settings.enabled, false);
  assert.equal(store.writes, writes + 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].event.eventName, 'audit.destination.test');
  assert.equal(calls[0].event.destinationRevision, current.settings.revision);
  assert.notEqual(current.settings.revision, form.fields.expected_revision);
  assert.equal(formLabelled(formsIn(answer.body), 'Save').fields.expected_revision, current.settings.revision);
  assert.ok(!answer.body.includes(secret));
});

async function testFormSite(t: import('node:test').TestContext, failTest = false) {
  const { site: browserSite, ...site } = await serveDestinationTestSite(t, { send: async () => failTest ? { kind: 'permanent_failure', reason: 'http_status', statusCode: 401 } : { kind: 'accepted' } });
  const { browser } = await signInThroughServer(browserSite, admin, organizationId);
  const form = formLabelled(formsIn((await browser.open('logging')).body), 'Test');
  return { browserSite, ...site, browser, form };
}
