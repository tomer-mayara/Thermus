import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLog, type AuditEvent } from '../../../src/logs/audit/audit-log.ts';
import { annToken, changePost, serveAdministration } from './fixtures/administration-routes-fixtures.ts';

const fields = { csrf_token: annToken, organization_id: 'org-a', membership_id: 'membership-user', revision: 'r7' };

for (const outcome of ['applied', 'denied', 'stale', 'unsupported', 'last-admin', 'busy', 'unavailable', 'unknown'] as const) {
  test(`Given a checked removal and ${outcome}, when the boundary records it, then one safe event uses the decided tenant and actor`, async () => {
    const events: AuditEvent[] = [];
    const { routes, organizations } = serveAdministration({ removal: outcome }, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
    await routes.handle(changePost('/members/remove', fields));
    assert.equal(organizations.administrationCalls.length, 1);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      timestamp: events[0]?.timestamp,
      eventName: 'organization.changed',
      organizationId: 'tenant-org-a',
      actor: { authority: 'hosted-provider-double', subject: 'user-ann' },
      action: 'remove-member',
      target: { membershipId: 'membership-user' },
      outcome,
    });
    assert.doesNotMatch(JSON.stringify(events), /csrf|session=|revision|r7/);
  });
}

test('Given trusted tenant A, when a removal form forges organization B, then B receives no event and no removal runs', async () => {
  const events: AuditEvent[] = [];
  const { routes, organizations } = serveAdministration({}, { routes: { audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
  assert.equal((await routes.handle(changePost('/members/remove', { ...fields, organization_id: 'org-b' }))).status, 409);
  assert.deepEqual(organizations.administrationCalls, []);
  assert.deepEqual(events.map(event => event.organizationId), ['tenant-org-a']);
  assert.equal(events[0]?.eventName === 'organization.changed' && events[0].outcome, 'stale');
});

for (const state of ['denied-access', 'invalid-origin', 'invalid-csrf'] as const) {
  test(`Given ${state}, when a removal is submitted, then no customer stream receives an event`, async () => {
    const events: AuditEvent[] = [];
    const decisions = state === 'denied-access' ? new Map([['user-ann', { allowed: false as const, reason: 'membership-inactive' as const }]]) : undefined;
    const { routes, organizations } = serveAdministration({}, { routes: { decisions, audit: new AuditLog({ writeAuditEvent: event => { events.push(event); } }) } });
    await routes.handle(changePost('/members/remove', state === 'invalid-csrf' ? { ...fields, csrf_token: 'forged' } : fields, state === 'invalid-origin' ? { Origin: 'https://attacker.example' } : {}));
    assert.deepEqual(events, []);
    assert.deepEqual(organizations.administrationCalls, []);
  });
}

for (const outcome of ['applied', 'unknown'] as const) {
  test(`Given ${outcome} and a throwing capture API, when removal completes, then the answer is preserved and the coordinator runs once`, async () => {
    const fail = () => { throw new Error('capture-secret'); };
    const { routes, organizations, failures } = serveAdministration({ removal: outcome }, { routes: { audit: { administrationChanged: fail, destinationChanged: fail } } });
    const response = await routes.handle(changePost('/members/remove', fields));
    assert.equal(response.status, outcome === 'applied' ? 200 : 503);
    assert.equal(organizations.administrationCalls.length, 1);
    assert.deepEqual(failures, []);
    assert.doesNotMatch(await response.text(), /capture-secret|Try again/);
  });
}
