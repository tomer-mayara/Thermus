import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuditEvent, AuditEventSink } from '../../../../src/logs/audit/audit-log.ts';
import { SystemLogger, type SystemLogRecord, type SystemLogSink } from '../../../../src/logs/system/system-logger.ts';

test('Given a system sink that throws, when an admitted call writes, then its failure escapes synchronously', () => {
  const failure = new Error('system write failed');
  const logger = new SystemLogger({ writeSystemLog: () => { throw failure; } });

  assert.throws(() => logger.info('the output failed'), (error) => error === failure);
});

test('Given a system sink that throws, when a default logger filters DEBUG, then the call returns without writing', () => {
  const logger = new SystemLogger({ writeSystemLog: () => { throw new Error('filtered output was written'); } });

  assert.doesNotThrow(() => logger.debug('hidden message'));
});

type Assignable<From, To> = [From] extends [To] ? true : false;
type MustBeFalse<Value extends false> = Value;
export type AuditSinkCannotReplaceSystemSink = MustBeFalse<Assignable<AuditEventSink, SystemLogSink>>;
export type SystemSinkCannotReplaceAuditSink = MustBeFalse<Assignable<SystemLogSink, AuditEventSink>>;
export type AuditEventCannotReplaceSystemRecord = MustBeFalse<Assignable<AuditEvent, SystemLogRecord>>;
export type SystemRecordCannotReplaceAuditEvent = MustBeFalse<Assignable<SystemLogRecord, AuditEvent>>;
