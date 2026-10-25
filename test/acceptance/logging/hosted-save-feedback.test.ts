import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { serveDestinationTestSite, destinationTestAdmin as admin, destinationTestOrganizationId as organizationId, destinationTestEndpoint as endpoint } from '../../support/in-process/logging-destination-test-site.ts';

for (const action of ['Save', 'Test']) {
  test(`Given edited Audit settings, when an Admin selects ${action}, then confirmed saved text sits above the buttons and the empty token field shows only its masked stored prefix`, async (t) => {
    const { site, service, store, tenantId, calls } = await serveDestinationTestSite(t);
    const { browser } = await signInThroughServer(site, admin, organizationId);
    const form = formLabelled(formsIn((await browser.open('logging')).body), action);
    const changedToken = 'new-private-feedback-token';
    const answer = await browser.submit({ ...form, fields: { ...form.fields, endpoint, token: changedToken, enabled: 'on' } });
    assert.equal(answer.status, 200);
    const { document } = parseHTML(answer.body);
    const marker = document.querySelector('#logging-saved');
    assert.equal(marker?.textContent, 'saved');
    assert.ok(marker?.closest('form'));
    const button = document.querySelector('button');
    assert.ok(button && marker);
    assert.ok(answer.body.indexOf('id="logging-saved"') < answer.body.indexOf('<button'));
    const token = document.querySelector('input[name="token"]');
    assert.equal(token?.getAttribute('placeholder'), 'new-****');
    assert.equal(token?.getAttribute('value'), '');
    assert.ok(!answer.body.includes(changedToken));
    const saved = await service.read(tenantId);
    assert.ok(saved.status === 'found');
    assert.equal(saved.settings.enabled, true);
    assert.equal(formLabelled(formsIn(answer.body), 'Save').fields.expected_revision, saved.settings.revision);
    assert.equal(calls.length, action === 'Test' ? 1 : 0);
    const resumed = formLabelled(formsIn(answer.body), 'Save');
    const encrypted = store.settings.get(tenantId)?.encryptedCredential;
    const kept = await browser.submit({ ...resumed, fields: { ...resumed.fields, endpoint, token: '', enabled: 'on' } });
    assert.equal(kept.status, 200);
    assert.equal(store.settings.get(tenantId)?.encryptedCredential, encrypted);
    assert.ok(!JSON.stringify([...store.settings.values()]).includes(changedToken));
    assert.ok(!site.log.lines.join('\n').includes(changedToken));
    assert.equal((await browser.open('logging')).body.includes('id="logging-saved">saved'), false);
  });
}

test('Given saved token feedback and removed Admin access, when the page or Test is requested, then no token preview, read, write, or send is permitted', async (t) => {
  const { site, service, store, calls } = await serveDestinationTestSite(t);
  const { browser } = await signInThroughServer(site, admin, organizationId);
  const form = formLabelled(formsIn((await browser.open('logging')).body), 'Test');
  let reads = 0;
  const read = service.read.bind(service);
  t.mock.method(service, 'read', async tenant => { reads++; return read(tenant); });
  site.world.memberships = [{ userId: admin.id, organizationId, roles: ['user'] }];
  const writes = store.writes;
  for (const answer of [await browser.open('logging'), await browser.submit({ ...form, fields: { ...form.fields, endpoint, token: '' } })]) {
    assert.equal(answer.status, 403);
    assert.doesNotMatch(answer.body, /acce\*{4}|acceptance-only-private-test-token/);
  }
  assert.equal(reads, 0);
  assert.equal(store.writes, writes);
  assert.equal(calls.length, 0);
});
