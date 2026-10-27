import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { composeLoggingStorage } from '../../../../src/app/logging-storage.ts';
import { relayContextCheckOf } from '../../../../src/app/mcp-gateway-composition.ts';
import { AccessContextSigner } from '../../../../src/accounts/identity/access-context-signer.ts';
import type { AccessContextClaims } from '../../../../src/accounts/identity/signed-access-context.ts';
import { AuditLog, type AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { AuditSnapshots } from '../../../../src/logs/audit/audit-snapshots.ts';
import { AuditRelayRoute, type RelayRefusal } from '../../../../src/interfaces/web/internal/audit-relay-route.ts';
import { AuditExportSenderSpy } from '../../../support/doubles/logging/audit-export-sender-spy.ts';
import { SnapshotSettingsStoreSpy } from '../../../support/doubles/logging/snapshot-settings-store-spy.ts';

// The relay route of the control plane with the real context check of identity (the public key of the gateway signing
// key) and the real capture and dispatch of audit-logs. Only the settings store and the export sender are doubles.

const authority = 'workos:client_01CONTROL';
const internalHost = 'thermus-control-plane:8080';
const organizationA = 'org_RELAY_A';
const access: AccessContextClaims = { authority, subject: 'user_RELAY_A', organizationId: organizationA, grants: [{ role: 'user', permissions: ['product:access'] }] };

async function relaySite(t: TestContext) {
  const keys = generateKeyPairSync('ed25519');
  const signer = new AccessContextSigner(keys.privateKey);
  const settings = new SnapshotSettingsStoreSpy();
  const sender = new AuditExportSenderSpy();
  const storage = composeLoggingStorage({ store: settings, close: async () => { settings.close(); } }, Buffer.alloc(32, 9), sender);
  const snapshots = new AuditSnapshots(storage.store, storage.dispatch);
  t.after(async () => { snapshots.close(); await storage.close(); });
  const refusals: RelayRefusal[] = [];
  const route = new AuditRelayRoute({
    internalHost, authority, verify: relayContextCheckOf(keys.publicKey), audit: new AuditLog(snapshots), reportRefusal: (refusal) => { refusals.push(refusal); },
  });
  const tenantId = (organizationId = organizationA) => `${authority}:${organizationId}`;
  await storage.service.save(tenantId(), { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'none', token: '', enabled: true });
  return {
    route, sender, settings, refusals, tenantId,
    contextFor: (claims: Partial<AccessContextClaims> = {}) => signer.sign({ ...access, ...claims }, 'bearer-token-of-the-request'),
    eventOf: (organizationId = organizationA, subject = access.subject): AuditEvent => {
      const events: AuditEvent[] = [];
      new AuditLog({ writeAuditEvent: (event) => { events.push(event); } }).toolCompleted({
        tool: 'search', input: { query: 'relayed query', reason: 'Find it' }, timestamp: new Date().toISOString(), organizationId: tenantId(organizationId),
        actor: { authority, subject }, operationId: randomUUID(), status: 'success', durationMs: 3, result: 'Relayed results',
      });
      return events[0] as AuditEvent;
    },
  };
}

function relay(event: unknown, context: string | undefined, target: { readonly host?: string; readonly path?: string } = {}): Request {
  const { host = internalHost, path = '/internal/audit' } = target;
  return new Request(`http://${host}${path}`, {
    method: 'POST',
    headers: { Host: host, 'Content-Type': 'application/json', ...(context === undefined ? {} : { 'Thermus-Access': context }) },
    body: JSON.stringify(event),
  });
}

test('Given a relay with a valid context for the organization of its event, when the route takes it, then it answers 202 and the capture exports the event one time', async (t) => {
  const site = await relaySite(t);
  const event = site.eventOf();

  const response = await site.route.handle(relay(event, await site.contextFor()));
  await site.sender.untilAttempts(1);

  assert.equal(response.status, 202);
  assert.deepEqual(site.sender.attempts.map((attempt) => attempt.event), [event]);
  assert.deepEqual(site.refusals, []);
});

test('Given a relay whose context names another organization, another user, or no valid signature, when the route takes it, then it refuses with 403, reports the refusal, and captures nothing', async (t) => {
  const site = await relaySite(t);
  const event = site.eventOf();
  const other = generateKeyPairSync('ed25519');
  const contexts = [
    await site.contextFor({ organizationId: 'org_RELAY_B' }),
    await site.contextFor({ subject: 'user_RELAY_OTHER' }),
    await new AccessContextSigner(other.privateKey).sign(access, 'bearer-token-of-the-request'),
    undefined,
  ];

  const reads = site.settings.reads.length;
  const statuses = [];
  for (const context of contexts) statuses.push((await site.route.handle(relay(event, context))).status);
  const otherOrganization = await site.route.handle(relay(site.eventOf('org_RELAY_B'), await site.contextFor()));
  await delay(20);

  assert.deepEqual([...statuses, otherOrganization.status], [403, 403, 403, 403, 403]);
  assert.deepEqual(site.refusals.map(({ reason, detail }) => [reason, detail]), [['context', 'organization'], ['actor', undefined], ['context', 'signature'], ['context', 'missing'], ['context', 'organization']]);
  assert.deepEqual(site.sender.attempts, []);
  assert.equal(site.settings.reads.length, reads, 'A refused relay starts no settings read of the capture.');
});

test('Given an accepted relay, when a relay with the same operation ID arrives again, then the route answers 202 and drops it, and the capture exports the event one time', async (t) => {
  const site = await relaySite(t);
  const event = site.eventOf();
  const context = await site.contextFor();

  const answers = [await site.route.handle(relay(event, context)), await site.route.handle(relay(event, context)), await site.route.handle(relay({ ...event }, await site.contextFor()))];
  await site.sender.untilAttempts(1);
  await delay(20);

  assert.deepEqual(answers.map(({ status }) => status), [202, 202, 202]);
  assert.equal(site.sender.attempts.length, 1);
  assert.deepEqual(site.refusals, []);
});

test('Given a request to /internal/* with another host, or another path or method, when the route takes it, then it answers 404 or 405 and captures nothing', async (t) => {
  const site = await relaySite(t);
  const event = site.eventOf();
  const context = await site.contextFor();

  const answers = [
    await site.route.handle(relay(event, context, { host: 'app.thermus.ai' })),
    await site.route.handle(relay(event, context, { path: '/internal/other' })),
    await site.route.handle(new Request(`http://${internalHost}/internal/audit`, { headers: { Host: internalHost } })),
  ];
  await delay(20);

  assert.deepEqual(answers.map(({ status }) => status), [404, 404, 405]);
  assert.equal(answers[2]?.headers.get('Allow'), 'POST');
  assert.deepEqual(site.sender.attempts, []);
  assert.deepEqual(site.refusals, []);
});

test('Given a relay body that is not JSON, not a tool completion, or above the body bound, when the route takes it, then it refuses it and captures nothing', async (t) => {
  const site = await relaySite(t);
  const context = await site.contextFor();
  const notJson = new Request(`http://${internalHost}/internal/audit`, { method: 'POST', headers: { Host: internalHost, 'Thermus-Access': context }, body: '{not json' });

  const answers = [
    await site.route.handle(notJson),
    await site.route.handle(relay({ ...site.eventOf(), eventName: 'audit.destination.test' }, context)),
    await site.route.handle(relay({ padding: 'x'.repeat(300 * 1024) }, context)),
  ];
  await delay(20);

  assert.deepEqual(answers.map(({ status }) => status), [400, 400, 413]);
  assert.deepEqual(site.refusals.map(({ reason }) => reason), ['body', 'event', 'body']);
  assert.deepEqual(site.sender.attempts, []);
});
