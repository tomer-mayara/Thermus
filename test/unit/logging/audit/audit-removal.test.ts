import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditLog, type AdministrationChange, type AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { encodeAuditEvent } from '../../../../src/logs/audit/otlp-audit-encoding.ts';

const context = { timestamp: '2026-10-25T12:00:00Z', organizationId: 'trusted-tenant', actor: { authority: 'workos', subject: 'admin' } };

for (const outcome of ['applied', 'denied', 'stale', 'unsupported', 'last-admin', 'busy', 'unavailable', 'unknown'] as const) {
  test(`Given a checked removal with ${outcome}, when it is captured and encoded, then only its safe membership metadata is exported`, () => {
    const events: AuditEvent[] = [];
    const audit = new AuditLog({ writeAuditEvent: event => { events.push(event); } });
    audit.administrationChanged({ ...context, action: 'remove-member', target: { membershipId: 'membership-1', token: 'secret' }, revision: 'private-revision', outcome } as unknown as AdministrationChange);
    assert.deepEqual(events, [{ ...context, eventName: 'organization.changed', action: 'remove-member', target: { membershipId: 'membership-1' }, outcome }]);
    const encoded = JSON.parse(encodeAuditEvent(events[0]!).toString('utf8'));
    const attributes = encoded.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
    assert.ok(attributes.some((attribute: { key: string; value: { stringValue: string } }) => attribute.key === 'target.membership_id' && attribute.value.stringValue === 'membership-1'));
    assert.doesNotMatch(JSON.stringify(encoded), /secret|private-revision|target.email|target.invitation_id/);
  });
}

for (const target of [{ membershipId: '' }, { membershipId: 'x'.repeat(1025) }, { email: 'wrong@example.com' }, { invitationId: 'wrong-kind' }]) {
  test(`Given an invalid removal target ${JSON.stringify(target).slice(0, 70)}, when capture runs, then no customer event is written`, () => {
    const events: AuditEvent[] = [];
    new AuditLog({ writeAuditEvent: event => { events.push(event); } }).administrationChanged({ ...context, action: 'remove-member', target, outcome: 'applied' } as unknown as AdministrationChange);
    assert.deepEqual(events, []);
  });
}

test('Given a removal export sink that throws, when a completed outcome is captured, then the caller receives no failure', () => {
  const audit = new AuditLog({ writeAuditEvent: () => { throw new Error('export unavailable'); } });
  assert.doesNotThrow(() => audit.administrationChanged({ ...context, action: 'remove-member', target: { membershipId: 'membership-1' }, outcome: 'applied' } as unknown as AdministrationChange));
});
