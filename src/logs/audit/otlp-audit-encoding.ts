import { auditActorName } from './audit-content.ts';
import type { AuditEvent } from './audit-log.ts';
import { AUDIT_SEND_LIMITS, AuditSendFailure } from './audit-send.ts';

type Attribute = { key: string; value: { stringValue: string } | { doubleValue: number } | { boolValue: boolean } };

function stringAttribute(key: string, value: string): Attribute {
  if (typeof value !== 'string') throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_event' });
  if (Buffer.byteLength(value) > AUDIT_SEND_LIMITS.requestBytes) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'request_too_large' });
  return { key, value: { stringValue: value } };
}

function timestampNanos(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)) throw new Error();
  const seconds = Date.parse(`${timestamp.slice(0, 19)}Z`);
  if (new Date(seconds).toISOString().slice(0, 19) !== timestamp.slice(0, 19)) throw new Error();
  const fraction = timestamp.slice(19, -1).replace('.', '').padEnd(9, '0');
  const nanos = BigInt(seconds) * 1_000_000n + BigInt(fraction);
  if (nanos < 0n || nanos > 18_446_744_073_709_551_615n) throw new Error();
  return nanos.toString();
}

function eventAttributes(event: AuditEvent): Attribute[] {
  if (event.eventName === 'audit.destination.test') {
    return [stringAttribute('synthetic.type', 'destination_test'), stringAttribute('destination.revision', event.destinationRevision)];
  }
  if (event.eventName === 'mcp.tool.completed') {
    if (!Number.isFinite(event.durationMs) || event.durationMs < 0) throw new Error();
    const input = event.tool === 'getURLAsMarkdown'
      ? stringAttribute('input.url', event.input.url)
      : stringAttribute('input.query', event.input.query);
    const result = event.result;
    if (typeof result.truncated !== 'boolean' || !Number.isSafeInteger(result.originalBytes) || !Number.isSafeInteger(result.capturedBytes) || result.originalBytes < 0 || result.capturedBytes !== Buffer.byteLength(result.text)) throw new Error();
    return [stringAttribute('operation.id', event.operationId), stringAttribute('tool.name', event.tool), stringAttribute('outcome', event.status), { key: 'duration.ms', value: { doubleValue: event.durationMs } },
      input, stringAttribute('input.reason', event.input.reason), stringAttribute('result.text', result.text),
      { key: 'result.original_bytes', value: { doubleValue: result.originalBytes } }, { key: 'result.captured_bytes', value: { doubleValue: result.capturedBytes } }, { key: 'result.truncated', value: { boolValue: result.truncated } }];
  }
  if (event.eventName === 'audit.destination.changed') {
    return [stringAttribute('action', event.action), stringAttribute('outcome', event.outcome)];
  }
  if (event.eventName !== 'organization.changed') throw new Error();
  const target = 'email' in event.target ? stringAttribute('target.email', event.target.email) : stringAttribute('target.invitation_id', event.target.invitationId);
  return [stringAttribute('action', event.action), target, stringAttribute('outcome', event.outcome), ...(event.role === undefined ? [] : [stringAttribute('role', event.role)])];
}

/** OTLP translation copies named fields; extra caller fields never become audit content. */
export function encodeAuditEvent(event: AuditEvent): Buffer {
  try {
    const name = auditActorName(event.actor.name);
    const attributes = [stringAttribute('organization.id', event.organizationId), stringAttribute('actor.authority', event.actor.authority), stringAttribute('actor.subject', event.actor.subject), ...(name === undefined ? [] : [stringAttribute('actor.name', name)]), ...eventAttributes(event)];
    const record = { timeUnixNano: timestampNanos(event.timestamp), severityNumber: 9, severityText: 'INFO', eventName: event.eventName, body: { stringValue: event.eventName }, attributes };
    const body = Buffer.from(JSON.stringify({ resourceLogs: [{ resource: { attributes: [stringAttribute('service.name', 'thermus.audit')] }, scopeLogs: [{ scope: { name: 'thermus.audit' }, logRecords: [record] }] }] }));
    if (body.length > AUDIT_SEND_LIMITS.requestBytes) throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'request_too_large' });
    return body;
  } catch (error) {
    if (error instanceof AuditSendFailure) throw error;
    throw new AuditSendFailure({ kind: 'permanent_failure', reason: 'invalid_event' });
  }
}
