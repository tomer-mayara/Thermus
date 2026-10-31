import assert from 'node:assert/strict';
import test from 'node:test';
import { DestinationSettingsService } from '../../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationSettingsStore, StoredDestinationSettings } from '../../../../src/logs/audit/destination-settings-store.ts';
import { encodeAuditEvent } from '../../../../src/logs/audit/otlp-audit-encoding.ts';

const actor = { authority: 'workos', subject: 'current-admin' };
const input = { expectedRevision: null as string | null, endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: false, token: 'saved-secret' };

for (const changedAfterSend of [false, true]) {
  test(`Given a disabled saved destination, when Test settles${changedAfterSend ? ' after its saved revision changes' : ''}, then ${changedAfterSend ? 'the obsolete result is suppressed' : 'one labelled synthetic event uses saved auth without changing settings'}`, async () => {
    let saved: StoredDestinationSettings | undefined;
    let writes = 0;
    const store: DestinationSettingsStore = {
      async read() { return saved ? { status: 'found', settings: saved } : { status: 'absent' }; },
      async save(_tenant, _revision, settings) { saved = { ...settings, revision: `r${++writes}` }; return { status: 'saved', settings: saved }; },
    };
    const requests: { endpoint: string; token: string; body: string }[] = [];
    const service = new DestinationSettingsService(store, Buffer.alloc(32, 1), {
      async send(destination, event) {
        requests.push({ endpoint: destination.endpoint, token: destination.auth.type === 'bearer' ? destination.auth.token : '', body: encodeAuditEvent(event).toString() });
        if (changedAfterSend) {
          assert.ok(saved);
          saved = { ...saved, revision: 'r2' };
        }
        return { kind: 'accepted' };
      },
    });
    await service.save('tenant-a', input);
    const before = saved;
    assert.ok(before);
    const result = await service.test({ organizationId: 'tenant-a', actor }, { ...input, expectedRevision: 'r1', token: '' });
    assert.deepEqual(result, changedAfterSend ? { status: 'conflict' } : { status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } });
    assert.equal(writes, 1);
    assert.ok(saved);
    assert.equal(saved.enabled, false);
    assert.equal(saved.encryptedCredential, before.encryptedCredential);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].endpoint, input.endpoint);
    assert.equal(requests[0].token, input.token);
    const record = JSON.parse(requests[0].body).resourceLogs[0].scopeLogs[0].logRecords[0];
    assert.equal(record.eventName, 'audit.destination.test');
    assert.equal(record.attributes.find((value: { key: string }) => value.key === 'destination.revision').value.stringValue, 'r1');
    assert.match(requests[0].body, /current-admin|tenant-a/);
    assert.doesNotMatch(requests[0].body, /saved-secret|fileName|lineNumber|stackTrace|mcp.tool.completed|organization.changed/);
  });
}
