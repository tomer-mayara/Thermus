import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { UnconfirmedChangeError } from '../../../src/accounts/organizations/change-records.ts';
import { accountRequest } from './fixtures/account-routes-fixtures.ts';
import { changePost, serveAdministration, validChanges } from './fixtures/administration-routes-fixtures.ts';

for (const [name, change] of Object.entries(validChanges)) {
  test(`Given a current trusted tenant and valid ${name}, when the change completes, then exactly one event uses its trusted actor and tenant`, async () => {
    const events: AuditEvent[] = [];
    const { routes, organizations } = serveAdministration({}, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
    assert.equal((await routes.handle(changePost(change.path, change.fields))).status, 303);
    assert.equal(organizations.administrationCalls.length, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventName, 'organization.changed');
    assert.equal(events[0]?.organizationId, 'tenant-org-a');
    assert.deepEqual(events[0]?.actor, { authority: 'hosted-provider-double', subject: 'user-ann' });
    assert.equal(events[0]?.eventName === 'organization.changed' && events[0].outcome, 'applied');
    assert.doesNotMatch(JSON.stringify(events), /csrf|session=/);
  });
}

test('Given trusted tenant A, when an invitation form names B, then its stale event stays in A and no change runs', async () => {
  const events: AuditEvent[] = [];
  const { routes, organizations } = serveAdministration({}, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
  const answer = await routes.handle(changePost(validChanges.send.path, { ...validChanges.send.fields, organization_id: 'org-b' }));
  assert.equal(answer.status, 409);
  assert.deepEqual(organizations.administrationCalls, []);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.organizationId, 'tenant-org-a');
  assert.equal(events[0]?.eventName === 'organization.changed' && events[0].outcome, 'stale');
});

test('Given trusted tenant A, when Audit logs Save or Test names B, then each refusal stays in A without reading or changing B', async () => {
  const events: AuditEvent[] = [];
  const { routes } = serveAdministration({}, { routes: {
    audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }),
    logging: { read: async () => { throw new Error('must not read'); }, save: async () => { throw new Error('must not save'); }, test: async () => { throw new Error('must not test'); } },
  } });
  const fields = { csrf_token: 'csrf-token-of-user-ann', organization_id: 'tenant-org-b', expected_revision: '', endpoint: 'https://collector.example/v1/logs', destination: 'custom', auth: 'bearer', token: '' };
  for (const action of ['save', 'test']) assert.equal((await routes.handle(changePost(`/logging/${action}`, fields))).status, 409);
  assert.deepEqual(events.map(event => event.eventName === 'audit.destination.changed' && [event.action, event.outcome, event.organizationId]), [['save', 'stale', 'tenant-org-a'], ['test', 'stale', 'tenant-org-a']]);
});

test('Given no current trusted tenant, when an invitation action is attempted, then no customer stream is selected', async () => {
  const events: AuditEvent[] = [];
  const { routes, organizations } = serveAdministration({}, { routes: {
    audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }),
    decisions: new Map([['user-ann', { allowed: false, reason: 'permission-required' }]]),
  } });
  assert.equal((await routes.handle(changePost(validChanges.send.path, validChanges.send.fields))).status, 403);
  assert.deepEqual(events, []);
  assert.deepEqual(organizations.administrationCalls, []);
});

for (const outcome of ['denied', 'unchanged', 'not-pending', 'address-in-use', 'unsupported'] as const) {
  test(`Given a trusted invitation action, when its result is ${outcome}, then one event keeps that public outcome`, async () => {
    const events: AuditEvent[] = [];
    const { routes } = serveAdministration({ change: outcome }, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
    await routes.handle(changePost(validChanges.send.path, validChanges.send.fields));
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventName === 'organization.changed' && events[0].outcome, outcome);
  });
}

for (const [failure, outcome, status] of [[new Error('check failure'), 'failed', 500], [new UnconfirmedChangeError(new Error('write secret')), 'unknown', 503]] as const) {
  test(`Given a ${outcome} invitation result, when the boundary captures it, then phase and one event survive without the cause`, async () => {
    const events: AuditEvent[] = [];
    const { routes } = serveAdministration({ change: failure }, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
    assert.equal((await routes.handle(changePost(validChanges.send.path, validChanges.send.fields))).status, status);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventName === 'organization.changed' && events[0].outcome, outcome);
    assert.doesNotMatch(JSON.stringify(events), /check failure|write secret/);
  });
}

test('Given saved Audit logs settings, when Save and Test complete and settings are read, then both Saves and Test emit safe metadata', async () => {
  const events: AuditEvent[] = [];
  const settings = { revision: 'r1', endpoint: 'https://private-collector.example/v1/logs', auth: 'none' as const, enabled: true, tokenPresent: false };
  const { routes } = serveAdministration({}, { routes: {
    audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }),
    logging: { read: async () => ({ status: 'found', settings }), save: async () => ({ status: 'saved', settings }), test: async () => ({ status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } }) },
  } });
  const fields = { csrf_token: 'csrf-token-of-user-ann', organization_id: 'tenant-org-a', expected_revision: 'r1', endpoint: settings.endpoint, destination: 'custom', auth: 'bearer', token: '' };
  assert.equal((await routes.handle(changePost('/logging/save', fields))).status, 200);
  assert.equal((await routes.handle(changePost('/logging/test', fields))).status, 200);
  assert.equal((await routes.handle(accountRequest('/logging', 'session=ann'))).status, 200);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(event => event.eventName === 'audit.destination.changed' && [event.action, event.outcome, event.organizationId]), [['save', 'saved', 'tenant-org-a'], ['save', 'saved', 'tenant-org-a'], ['test', 'tested', 'tenant-org-a']]);
  assert.doesNotMatch(JSON.stringify(events), /private-collector|accepted|csrf|r1/);
});

test('Given a throwing capture API, when an invitation or Audit logs action completes, then the public result stays complete and each action runs once', async () => {
  let saves = 0;
  let tests = 0;
  const fail = () => { throw new Error('private-capture-cause'); };
  const settings = { revision: 'r1', endpoint: 'https://collector.example/v1/logs', auth: 'none' as const, enabled: false, tokenPresent: false };
  const { routes, organizations, failures } = serveAdministration({}, { routes: {
    audit: { administrationChanged: fail, destinationChanged: fail },
    logging: { read: async () => ({ status: 'found', settings }), save: async () => { saves++; return { status: 'saved', settings }; }, test: async () => { tests++; return { status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } }; } },
  } });
  const invitation = await routes.handle(changePost(validChanges.send.path, validChanges.send.fields));
  const fields = { csrf_token: 'csrf-token-of-user-ann', organization_id: 'tenant-org-a', expected_revision: 'r1', endpoint: settings.endpoint, destination: 'custom', auth: 'bearer', token: '' };
  const saved = await routes.handle(changePost('/logging/save', fields));
  const tested = await routes.handle(changePost('/logging/test', fields));
  assert.deepEqual([invitation.status, saved.status, tested.status], [303, 200, 200]);
  assert.deepEqual([organizations.administrationCalls.length, saves, tests], [1, 2, 1]);
  assert.deepEqual(failures, []);
});
