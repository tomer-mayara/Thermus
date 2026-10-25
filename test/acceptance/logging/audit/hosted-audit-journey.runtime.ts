import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openAuditSenderSite } from '../../../support/container/audit-sender-site.ts';

interface CollectorRecord {
  readonly eventName: string;
  readonly attributes: { key: string; value: { stringValue?: string; doubleValue?: number; boolValue?: boolean } }[];
}

function attributesOf(record: CollectorRecord) {
  return Object.fromEntries(record.attributes.map(attribute => [attribute.key, attribute.value]));
}

function assertBoundedToolRecord(record: CollectorRecord, productText: string): void {
  const tool = attributesOf(record);
  assert.equal(tool['tool.name'].stringValue, 'search');
  assert.equal(tool.outcome.stringValue, 'success');
  assert.equal(tool['input.query'].stringValue, 'journey query token="[REDACTED]"');
  assert.equal(tool['input.reason'].stringValue, 'journey reason api_key="[REDACTED]"');
  assert.equal(tool['result.truncated'].boolValue, true);
  assert.equal(tool['result.original_bytes'].doubleValue, Buffer.byteLength(productText));
  assert.ok((tool['result.captured_bytes'].doubleValue ?? Infinity) <= 65_536);
  assert.equal(tool['result.captured_bytes'].doubleValue, Buffer.byteLength(tool['result.text'].stringValue ?? ''));
  assert.match(tool['result.text'].stringValue ?? '', /^journey-public-result password="\[REDACTED\]"/);
  assert.match(tool['result.text'].stringValue ?? '', /\[TRUNCATED\]$/);
}

test('S2-04 Given a current password-authenticated Admin and a reachable Collector, when the Admin saves disabled, Tests once, enables, loads a snapshot by activity, and uses MCP and shipped Admin actions, then the Collector receives bounded content and administration metadata while product outcomes and system output stay independent', { timeout: 120_000 }, async t => {
  const collector = await openAuditSenderSite(t, 'collector');
  const journey = await collector.publicJourney();
  assert.equal(journey.session.mfaCompleted, false);
  assert.deepEqual([journey.accessBefore.status, journey.accessAfter.status], [200, 200]);
  assert.deepEqual(JSON.parse(journey.accessBefore.body), JSON.parse(journey.accessAfter.body));
  assert.deepEqual([journey.saved, journey.enabled, ...journey.administration], [303, 303, 303, 303, 303, 303]);
  assert.ok(journey.disabled.status === 'found');
  assert.ok(journey.enabledSettings.status === 'found');
  assert.equal(journey.disabled.settings.enabled, false);
  assert.deepEqual(journey.afterTest, journey.disabled);
  assert.equal(journey.tested.status, 200);
  assert.match(journey.tested.body, /Destination accepted the Test event/);
  assert.equal(journey.enabledSettings.settings.enabled, true);
  assert.notEqual(journey.enabledSettings.settings.revision, journey.disabled.settings.revision);
  assert.equal(journey.settingsWrites, 4);
  assert.deepEqual(journey.cold.content, [{ type: 'text', text: journey.productText }]);
  assert.deepEqual(journey.product.content, [{ type: 'text', text: journey.productText }]);
  assert.ok(Buffer.byteLength(journey.productText) > 65_536);
  assert.match(journey.productText, /journey-product-tail$/);
  assert.deepEqual(journey.outcomes, Array.from({ length: 5 }, () => ({ kind: 'accepted' })));
  assert.equal(journey.invitations.length, 1);
  assert.equal(journey.invitations[0]?.state, 'revoked');

  const records = await collector.collectorRecords(6) as unknown as CollectorRecord[];
  assert.equal(records.length, 6);
  for (const record of records) {
    const attributes = attributesOf(record);
    assert.equal(attributes['organization.id'].stringValue, journey.tenant);
    assert.equal(attributes['actor.subject'].stringValue, journey.actor);
    assert.equal(attributes['actor.authority'].stringValue, journey.authority);
  }
  const synthetic = records.filter(record => record.eventName === 'audit.destination.test');
  assert.equal(synthetic.length, 1);
  assert.equal(attributesOf(synthetic[0])['destination.revision'].stringValue, journey.disabled.settings.revision);
  assert.equal(attributesOf(synthetic[0])['synthetic.type'].stringValue, 'destination_test');
  const tools = records.filter(record => record.eventName === 'mcp.tool.completed');
  assert.equal(tools.length, 1);
  assertBoundedToolRecord(tools[0], journey.productText);
  const administration = records.filter(record => record.eventName === 'organization.changed').map(attributesOf);
  assert.deepEqual(administration.map(attributes => [attributes.action.stringValue, attributes.outcome.stringValue]), [
    ['invite', 'applied'], ['resend-invitation', 'applied'], ['revoke-invitation', 'applied'],
  ]);
  assert.equal(administration[0]['target.email'].stringValue, journey.invitations[0]?.email);
  assert.equal(administration[0].role.stringValue, 'user');
  for (const action of administration.slice(1)) assert.equal(action['target.invitation_id'].stringValue, journey.invitations[0]?.id);
  const saved = records.filter(record => record.eventName === 'audit.destination.changed').map(attributesOf);
  assert.deepEqual(saved.map(attributes => [attributes.action.stringValue, attributes.outcome.stringValue]), [['save', 'unchanged']]);
  assert.doesNotMatch(JSON.stringify(records), /journey-cold-trigger|journey-private-(query|reason|result)-token|audit-runtime-only-token|collector\.audit\.test|encryptedCredential|csrf|invitation-token|invitation_url/);
  assert.doesNotMatch(journey.systemOutput, /journey query|journey reason|journey-public-result|journey-product-tail|journey-cold-trigger|journey-private-|audit-runtime-only-token/);
  t.diagnostic(`Actual Collector ${collector.collectorImage}, native DNS and verified TLS on an isolated internal Docker network. WorkOS Password exchange, tool operations, and settings store are controlled. Shared public capture is composed explicitly; default hosted factory wiring has separate acceptance coverage. No live provider, PostgreSQL, rollout, backup, or release proof is claimed.`);
});
