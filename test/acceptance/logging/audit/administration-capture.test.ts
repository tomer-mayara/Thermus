import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { formsIn, formLabelled } from '../../../support/drivers/browser/hosted-browser.ts';
import { serveAuditAdministrationSite as captureSite, auditAdministrationAdmin as admin } from '../../../support/in-process/audit-administration-site.ts';

test('Given a current Admin and saved destination, when Test completes, then Save and Test action events are separate from the synthetic test and contains no sender response', async t => {
  const events: AuditEvent[] = [];
  const { browser, sent } = await captureSite(t, event => { events.push(event); });
  const form = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  await browser.submit({ ...form, fields: { ...form.fields, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: 'audit-test-token' } });
  const saved = formLabelled(formsIn((await browser.open('logging')).body), 'Test');
  const response = await browser.submit({ ...saved, fields: { ...saved.fields, endpoint: 'https://collector.example/v1/logs', token: '' } });
  assert.equal(response.status, 200, response.body);
  assert.deepEqual(events.map(event => event.eventName === 'audit.destination.changed' && [event.action, event.outcome]), [['save', 'saved'], ['save', 'unchanged'], ['test', 'tested']]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.eventName, 'audit.destination.test');
  assert.deepEqual(sent[0]?.actor, { authority: 'workos:client_test', subject: admin.id, name: 'Admin Example' });
  assert.ok(events.every(event => (event.actor as { name?: string }).name === 'Admin Example'));
  assert.doesNotMatch(JSON.stringify(events), /accepted|collector|revision/);
});

for (const failure of ['none', 'throw', 'refuse', 'record-throw'] as const) {
  test(`Given a current Admin and ${failure} capture failure, when an invitation completes, then it is sent once and its customer event uses current trusted context`, async t => {
    const events: AuditEvent[] = [];
    const { browser, site, tenantId } = await captureSite(t, event => {
      events.push(event);
      if (failure === 'throw') throw new Error('private-export-cause');
      return failure === 'refuse' ? false : undefined;
    });
    if (failure === 'record-throw') {
      const info = site.log.info;
      t.mock.method(site.log, 'info', (message: string) => {
        if (message.startsWith('Account change record: ')) throw new Error('private-record-cause');
        info(message);
      });
    }
    const form = formLabelled(formsIn((await browser.open('members')).body), 'Invite');
    const response = await browser.submit({ ...form, fields: { ...form.fields, email: 'invited@example.com', role: 'user' } });
    assert.equal(response.status, 303, response.body);
    assert.equal(site.world.invitations.filter(invitation => invitation.email === 'invited@example.com').length, 1);
    const writes = site.world.fake.takeRequests().filter(request => request.method === 'POST' && request.path === '/user_management/invitations');
    assert.equal(writes.length, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventName, 'organization.changed');
    assert.equal(events[0]?.organizationId, tenantId);
    assert.deepEqual(events[0]?.actor, { authority: 'workos:client_test', subject: admin.id, name: 'Admin Example' });
    assert.doesNotMatch(response.body, /private-export-cause|private-record-cause/);
  });
}

test('Given a current Admin and enabled capture, when Audit logs Save completes, then one metadata event names the trusted tenant and actor without settings content', async t => {
  const events: AuditEvent[] = [];
  const { browser, tenantId, store, site } = await captureSite(t, event => { events.push(event); });
  const form = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const response = await browser.submit({ ...form, fields: { ...form.fields, endpoint: 'https://private-collector.example/v1/logs', auth: 'bearer', token: 'private-capture-token', enabled: 'on' } });
  assert.equal(response.status, 200);
  assert.equal(store.writes, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventName, 'audit.destination.changed');
  assert.equal(events[0]?.organizationId, tenantId);
  assert.equal(events[0]?.actor.subject, admin.id);
  assert.doesNotMatch(JSON.stringify(events), /private-collector|private-capture-token|csrf/);
  assert.doesNotMatch(site.log.lines.join('\n'), /private-capture-token/);
});

for (const failure of ['throw', 'refuse'] as const) {
  test(`Given a current Admin and a customer sink that ${failure}s, when Audit logs Save completes, then its public outcome stays complete and its write is not replayed`, async t => {
    let captures = 0;
    const { browser, store } = await captureSite(t, () => { captures++; if (failure === 'throw') throw new Error('private-sink-cause'); return false; });
    const form = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
    const response = await browser.submit({ ...form, fields: { ...form.fields, endpoint: 'https://collector.example/v1/logs', auth: 'bearer', token: 'audit-test-token', enabled: 'on' } });
    assert.equal(response.status, 200);
    assert.equal(store.writes, 1);
    assert.equal(captures, 1);
    assert.doesNotMatch(response.body, /private-sink-cause/);
  });
}
