import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditLog } from '../../../../src/logs/audit/audit-log.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';

const context = { timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a', stack: 'private actor stack' }, file: '/private/source.ts', line: 9, stack: 'private stack', eventName: 'caller.name' };

test('Given extra caller fields, when a tool completes, then only the tool audit contract is emitted', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  audit.toolCompleted({ ...context, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 3 });
  assert.deepEqual(events, [{ timestamp: context.timestamp, organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, eventName: 'mcp.tool.completed', operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 3 }]);
});

test('Given invitation target extras, when administration changes, then nested fields and absent role are projected', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  const target = { invitationId: 'invitation-a', stack: 'private target stack', file: '/private/target.ts' };
  audit.administrationChanged({ ...context, action: 'revoke-invitation', target, outcome: 'applied' });
  assert.deepEqual(events, [{ timestamp: context.timestamp, organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, eventName: 'organization.changed', action: 'revoke-invitation', target: { invitationId: 'invitation-a' }, outcome: 'applied' }]);
});

test('Given an email target and role, when administration changes, then the named fields are retained', () => {
  const events: AuditEvent[] = [];
  const audit = new AuditLog({ writeAuditEvent: (event) => { events.push(event); } });
  const target = { email: 'new@example.com', stack: 'private target stack' };
  audit.administrationChanged({ ...context, action: 'invite', target, role: 'user', outcome: 'denied' });
  assert.deepEqual(events, [{ timestamp: context.timestamp, organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, eventName: 'organization.changed', action: 'invite', target: { email: 'new@example.com' }, role: 'user', outcome: 'denied' }]);
});

test('Given a sink that throws, when an explicit audit event is recorded, then the completed action can continue', () => {
  const audit = new AuditLog({ writeAuditEvent: () => { throw new Error('private sink detail'); } });
  assert.doesNotThrow(() => audit.toolCompleted({ ...context, operationId: 'operation-a', tool: 'search', status: 'success', durationMs: 3 }));
  assert.doesNotThrow(() => audit.administrationChanged({ ...context, action: 'resend-invitation', target: { invitationId: 'invitation-a' }, outcome: 'applied' }));
});

// Compare public members so private class state cannot enforce separation by itself.
type PublicSurface<Value> = Pick<Value, keyof Value>;
type Assignable<From, To> = [From] extends [To] ? true : false;
type MustBeFalse<Value extends false> = Value;
export type AuditCannotReplaceSystem = MustBeFalse<Assignable<PublicSurface<AuditLog>, import('../../../../src/logs/system/system-logger.ts').SystemLog>>;
export type SystemCannotReplaceAudit = MustBeFalse<Assignable<import('../../../../src/logs/system/system-logger.ts').SystemLog, PublicSurface<AuditLog>>>;
export type SystemLoggerCannotReplaceAudit = MustBeFalse<Assignable<import('../../../../src/logs/system/system-logger.ts').SystemLogger, PublicSurface<AuditLog>>>;
