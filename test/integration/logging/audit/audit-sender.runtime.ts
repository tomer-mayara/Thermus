import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { openAuditSenderSite } from '../../../support/container/audit-sender-site.ts';

const completion: AuditEvent = {
  eventName: 'mcp.tool.completed', timestamp: '2026-10-23T12:34:56.789Z',
  organizationId: 'runtime-org', actor: { authority: 'runtime', subject: 'admin' },
  operationId: 'runtime-operation', tool: 'search', status: 'success', durationMs: 12,
};

test('Given a trusted public-address TLS receiver, when None and Bearer events are sent, then only the supplied audit data and auth reach that socket', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'receiver');
  const outcomes = await site.send([
    { endpoint: site.endpoint, auth: { type: 'none' }, event: completion },
    { endpoint: site.endpoint, auth: { type: 'bearer', token: site.token }, event: completion },
  ]);
  assert.deepEqual(outcomes, [{ kind: 'accepted' }, { kind: 'accepted' }]);
  const requests = await site.requests();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[1].headers.authorization, `Bearer ${site.token}`);
  for (const request of requests) {
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/logs');
    assert.equal(request.headers['content-type'], 'application/json');
    assert.equal(request.headers.host, 'collector.audit.test:4318');
    assert.equal(request.servername, 'collector.audit.test');
    assert.equal(request.localAddress, site.address);
    assert.equal(request.headers['x-system'], undefined);
    assert.equal(request.headers['x-axiom-dataset'], undefined);
    assert.doesNotMatch(request.body, /platform-secret|fileName|lineNumber|stackTrace/);
    const payload = JSON.parse(request.body);
    const record = payload.resourceLogs[0].scopeLogs[0].logRecords[0];
    assert.equal(record.timeUnixNano, '1792758896789000000');
    assert.match(request.body, /runtime-org/);
    assert.match(request.body, /mcp\.tool\.completed/);
  }
});

test('Given an open-source Collector with None and Bearer receivers, when audit events are sent, then the Collector accepts both and rejects the wrong token', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'collector');
  const outcomes = await site.send([
    { endpoint: site.endpoint, auth: { type: 'none' }, event: completion },
    { endpoint: site.bearerEndpoint, auth: { type: 'bearer', token: site.token }, event: completion },
    { endpoint: site.bearerEndpoint, auth: { type: 'bearer', token: 'wrong-runtime-token' }, event: completion },
  ]);
  assert.deepEqual(outcomes.slice(0, 2), [{ kind: 'accepted' }, { kind: 'accepted' }]);
  assert.equal(outcomes[2].kind, 'permanent_failure');
  assert.equal('statusCode' in outcomes[2] && outcomes[2].statusCode, 401);
  const exported = await site.collectorRecords(2);
  assert.equal(exported.length, 2);
  for (const record of exported) {
    assert.equal(record.timeUnixNano, '1792758896789000000');
    assert.match(JSON.stringify(record), /runtime-org/);
    assert.match(JSON.stringify(record), /mcp\.tool\.completed/);
  }
  t.diagnostic(`Collector ${site.collectorImage}; isolated public-address TLS ${site.address}.`);
});

test('Given a trusted public-address receiver, when its hostname or trust chain is wrong, then no event or Bearer token reaches HTTP', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'receiver');
  const badHost = await site.send([
    { endpoint: site.endpoint.replace('collector.audit.test', 'wrong.audit.test'), auth: { type: 'bearer', token: site.token }, event: completion },
  ]);
  const untrusted = await site.send([
    { endpoint: site.endpoint, auth: { type: 'bearer', token: site.token }, event: completion },
  ], { trustCertificate: false });
  assert.equal(badHost[0].kind, 'permanent_failure');
  assert.equal(untrusted[0].kind, 'permanent_failure');
  assert.deepEqual(await site.requests(), []);
});

test('Given a hostname that changes from public to loopback, when the same sender sends again, then the new DNS answer is refused before HTTP', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'receiver');
  const outcomes = await site.send([
    { endpoint: site.endpoint, auth: { type: 'none' }, event: completion },
    { endpoint: site.endpoint, auth: { type: 'bearer', token: site.token }, event: completion, resolveTo: '127.0.0.1' },
  ]);
  assert.deepEqual(outcomes[0], { kind: 'accepted' });
  assert.equal(outcomes[1].kind, 'permanent_failure');
  assert.equal('reason' in outcomes[1] && outcomes[1].reason, 'unsafe_destination');
  assert.equal((await site.requests()).length, 1);
});

test('Given a receiver that redirects, when an authenticated audit event is sent, then the redirect target gets no request', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'receiver');
  const outcomes = await site.send([
    { endpoint: site.endpoint.replace('/v1/logs', '/redirect'), auth: { type: 'bearer', token: site.token }, event: completion },
  ]);
  assert.equal(outcomes[0].kind, 'permanent_failure');
  assert.equal('statusCode' in outcomes[0] && outcomes[0].statusCode, 307);
  const requests = await site.requests();
  assert.deepEqual(requests.map((request) => request.path), ['/redirect']);
});

test('Given an actual stalled TLS response, when its caller cancels, then the send settles and the sender can send a later event', { timeout: 120_000 }, async (t) => {
  const site = await openAuditSenderSite(t, 'receiver');
  const outcomes = await site.send([
    { endpoint: site.endpoint.replace('/v1/logs', '/hold'), auth: { type: 'none' }, event: completion, cancelAfterMs: 200 },
    { endpoint: site.endpoint, auth: { type: 'none' }, event: completion },
  ]);
  assert.deepEqual(outcomes, [{ kind: 'cancelled' }, { kind: 'accepted' }]);
  const requests = await site.requests();
  assert.deepEqual(requests.map((request) => request.path), ['/hold', '/v1/logs']);
});
