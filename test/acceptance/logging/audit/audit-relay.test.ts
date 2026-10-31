import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { gatewayKeyPairOf } from '../../../support/fixtures/hosted-tenant.ts';
import { gatewayOrganization, gatewayUser, openHostedGatewaySite, otherGatewayOrganization } from '../../../support/in-process/hosted-gateway-site.ts';

test('Given a relay with a valid context for organization A, when it reaches POST /internal/audit, then the event is captured and exported one time', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  const event = await site.relayEventOf();

  const response = await site.relay(event, await site.contextFor());
  await site.sender.untilAttempts(1);
  await delay(50);

  assert.equal(response.status, 202);
  assert.equal(site.sender.attempts.length, 1);
  const [exported] = site.sender.attempts;
  assert.deepEqual(exported?.event, event);
  assert.equal(exported?.event.organizationId, site.tenantId());
});

test('Given a relay with a context for another organization, an invalid context, or no context, when it reaches POST /internal/audit, then it is refused and nothing is captured', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  const event = await site.relayEventOf();
  const refused = [
    ['a context for another organization', await site.contextFor({ organizationId: otherGatewayOrganization })],
    ['a context of another user', await site.contextFor({ subject: 'user_01OTHERUSER' })],
    ['a context with another signing key', await site.contextFor({ key: gatewayKeyPairOf().privateKey })],
    ['an expired context', await site.contextFor({ issuedAtUnixSeconds: Math.floor(Date.now() / 1_000) - 600 })],
    ['a malformed context', 'not-a-context'],
    ['no context', undefined],
  ] as const;
  const reads = site.settings.reads.length;

  for (const [label, context] of refused) {
    const response = await site.relay(event, context);
    assert.equal(response.status, 403, label);
  }
  await delay(50);

  assert.deepEqual(site.sender.attempts, []);
  assert.equal(site.settings.reads.length, reads, 'A refused relay starts no settings read of the capture.');
  assert.equal(site.log.lines.filter((line) => /^ERROR Audit relay refusal: /.test(line)).length, refused.length, site.log.lines.join('\n'));
});

test('Given a relay with an operation ID that the route already accepted, when it arrives again, then the route drops it', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  const event = await site.relayEventOf();
  const context = await site.contextFor();

  const first = await site.relay(event, context);
  await site.sender.untilAttempts(1);
  const repeated = await site.relay(event, context);
  const other = await site.relay(await site.relayEventOf(), context);
  await site.sender.untilAttempts(2);
  await delay(50);

  assert.deepEqual([first.status, repeated.status, other.status], [202, 202, 202]);
  assert.equal(site.sender.attempts.length, 2);
  assert.equal(new Set(site.sender.attempts.map((attempt) => attempt.event.eventName === 'mcp.tool.completed' ? attempt.event.operationId : '')).size, 2);
});

test('Given a request to /internal/* with the public host, when it arrives, then the answer is 404 and nothing is captured', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  const event = await site.relayEventOf();
  const context = await site.contextFor();

  const answers = [
    await site.relay(event, context, { host: 'thermus.example' }),
    await site.relay(event, context, { host: 'thermus.example', path: '/internal/other' }),
    await site.relay(event, context, { path: '/internal/other' }),
  ];
  await delay(50);

  assert.deepEqual(answers.map(({ status }) => status), [404, 404, 404]);
  assert.deepEqual(site.sender.attempts, []);
});

test('Given a relay of an event that is not a tool completion of its user, when it reaches the route, then it is refused and nothing is captured', { timeout: 30_000 }, async (t) => {
  const site = await openHostedGatewaySite(t);
  await site.enableExport();
  const event = await site.relayEventOf();
  const invalid = [
    { ...event, eventName: 'organization.changed' },
    { ...event, organizationId: `${site.authority}:${otherGatewayOrganization}` },
    { ...event, actor: { authority: site.authority, subject: 'user_01OTHERUSER' } },
    { ...event, status: 'unknown-status' },
  ];

  const answers = [];
  for (const body of invalid) answers.push((await site.relay(body, await site.contextFor())).status);
  await delay(50);

  assert.deepEqual(answers, [400, 403, 403, 400]);
  assert.deepEqual(site.sender.attempts, []);
  assert.equal(gatewayUser.id, (event.actor as { subject?: string }).subject);
  assert.equal(event.organizationId, `${site.authority}:${gatewayOrganization}`);
});
