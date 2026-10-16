import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { SignupContractDriver } from '../../support/drivers/workos/signup-contract-driver.ts';

test('Given a fresh personal external ID and acceptance record in Staging, when eight requests create it together, then one new-create winner saves the record and inherits the required roles, and all other requests refuse', { timeout: 60_000 }, async (t) => {
  const driver = SignupContractDriver.fromEnvironment();
  for (let round = 0; round < 3; round++) {
    const externalId = `FS01-${randomUUID()}`;
    const metadata = {
      schema: 'thermus-signup-v1', documents_version: 'test-bundle-v1', subject: `FS01-${randomUUID()}`,
      accepted_at: new Date().toISOString(), terms_version: 'test-terms-v1',
      terms_sha256: 'a'.repeat(64), notice_version: 'test-notice-v1',
      notice_sha256: 'b'.repeat(64), agreement_version: 'test-agreement-v1',
    };
    try {
      const outcomes = await driver.createTogether(externalId, metadata, 8);
      const winners = outcomes.filter((result) => result.status === 'fulfilled');
      assert.equal(winners.length, 1, 'Exactly one call must report a new organization');
      const winner = winners[0];
      assert.ok(winner?.status === 'fulfilled');
      const refusals = outcomes.filter((result) => result.status === 'rejected');
      assert.equal(refusals.length, 7);
      for (const refusal of refusals) {
        assert.deepEqual({ status: refusal.reason.status, code: refusal.reason.code }, { status: 400, code: 'external_id_already_used' });
      }
      const saved = await driver.readByExternalId(externalId);
      assert.equal(saved.id, winner.value.id);
      assert.equal(saved.externalId, externalId);
      assert.deepEqual(saved.metadata, metadata);
      assert.deepEqual(winner.value.metadata, metadata);
      assert.deepEqual(saved.domains, []);
      const roles = await driver.roles(saved.id);
      assert.deepEqual(roles, {
        member: [], user: ['product:access'], admin: ['user-grants:manage'],
        'super-admin': ['admin-grants:manage', 'billing:manage'],
      });
      t.diagnostic(JSON.stringify({ round: round + 1, externalId, organizationId: saved.id, creates: 8, winners: 1, refusals: { count: 7, status: 400, code: 'external_id_already_used' }, metadataFields: Object.keys(metadata).length, roles }));
    } finally {
      const removed = await driver.cleanup(externalId);
      t.diagnostic(JSON.stringify({ externalId, removed }));
    }
  }
});
