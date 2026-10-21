import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DirectoryChangeResult } from '../../../src/accounts/organizations/organization-directory.ts';
import { actorOf, administrationWith, changeOf, recordLines, rolesIn } from './fixtures/administration-fixtures.ts';

describe('OrganizationAdministration safe grant changes', () => {
  test('Given a form that shows an older revision of the target, when the actor asks for the change, then it is stale, and the directory changes nothing', async () => {
    const { directory, records, administration } = administrationWith();
    const shown = changeOf(directory, { target: 'user-cy', role: 'user', action: 'revoke' });
    await administration.changeGrant(actorOf('user-sam'), changeOf(directory, { target: 'user-cy', role: 'admin', action: 'revoke' }));

    const outcome = await administration.changeGrant(actorOf('user-eve'), shown);

    assert.equal(outcome, 'stale');
    assert.deepEqual(rolesIn(directory, 'user-cy'), ['user']);
    assert.deepEqual(directory.grantChanges.map(({ role }) => role), ['admin']);
    assert.deepEqual(recordLines(records).at(-1), 'user-eve in org-a: revoke user for membership-user-cy-org-a: stale');
  });

  test('Given a grant that was applied and then revoked by another actor, when the first actor retries its request, then the retry is stale and never restores the revoked access', async () => {
    const { directory, administration } = administrationWith();
    const request = changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' });

    const first = await administration.changeGrant(actorOf('user-eve'), request);
    const revoked = await administration.changeGrant(actorOf('user-cy'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'revoke' }));
    const retry = await administration.changeGrant(actorOf('user-eve'), request);

    assert.deepEqual([first, revoked, retry], ['applied', 'applied', 'stale']);
    assert.deepEqual(rolesIn(directory, 'user-dora'), ['member']);
    assert.equal(directory.grantChanges.length, 2);
  });

  test('Given two actors that change the same membership at the same time from the same revision, when the directory runs both, then one change is applied, the other is stale, and the grant outside the authority of each stays', async () => {
    const { directory, records, administration } = administrationWith();
    const release = directory.holdChanges();
    const revokeUser = administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-cy', role: 'user', action: 'revoke' }));
    const revokeAdmin = administration.changeGrant(actorOf('user-sam'), changeOf(directory, { target: 'user-cy', role: 'admin', action: 'revoke' }));

    while (directory.grantChanges.length < 2) await new Promise((resolve) => setImmediate(resolve));
    release();
    const outcomes = await Promise.all([revokeUser, revokeAdmin]);

    assert.deepEqual(outcomes, ['applied', 'stale']);
    assert.deepEqual(rolesIn(directory, 'user-cy'), ['admin']);
    assert.deepEqual(records.map(({ outcome }) => outcome), ['applied', 'stale']);
  });

  for (const afterChange of [true, false]) {
    test(`Given a directory change that fails ${afterChange ? 'after' : 'before'} its effect, when the actor asks for the change and then retries the same request, then the first outcome is recorded as unknown and reaches the caller, and the retry ${afterChange ? 'is stale and changes nothing again' : 'is applied one time'}`, async () => {
      const { directory, records, administration } = administrationWith();
      const timeout = new Error('directory change timed out');
      directory.queue('changeGrant', { error: timeout, afterChange });
      const request = changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' });

      await assert.rejects(administration.changeGrant(actorOf('user-eve'), request), timeout);
      const retry = await administration.changeGrant(actorOf('user-eve'), request);

      assert.equal(retry, afterChange ? 'stale' : 'applied');
      assert.deepEqual(rolesIn(directory, 'user-dora'), ['user']);
      assert.deepEqual(recordLines(records), [
        'user-eve in org-a: grant user for membership-user-dora-org-a: unknown',
        `user-eve in org-a: grant user for membership-user-dora-org-a: ${afterChange ? 'stale' : 'applied'}`,
      ]);
    });
  }

  for (const result of ['unsupported', 'stale'] as const) {
    test(`Given a directory that answers ${result} for a change, when the actor asks for it, then the service refuses it as ${result}, simulates no safe change of its own, and records it`, async () => {
      const { directory, records, administration } = administrationWith();
      directory.queue('changeGrant', { result });

      const outcome = await administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' }));

      assert.equal(outcome, result);
      assert.deepEqual(rolesIn(directory, 'user-dora'), ['member']);
      assert.equal(directory.grantChanges.length, 1, 'the service makes no second attempt');
      assert.deepEqual(records.map(({ outcome: recorded }) => recorded), [result]);
    });
  }

  for (const [label, answer] of [['no result', undefined], ['an unknown result', { outcome: 'probably-applied' }], ['a result without an outcome', {}]] as const) {
    test(`Given a directory that gives ${label} for a change, when the actor asks for it, then the service cannot establish a safe result: it records the outcome as unknown and fails`, async () => {
      const { directory, records, administration } = administrationWith();
      directory.changeGrant = async () => answer as unknown as DirectoryChangeResult;

      await assert.rejects(administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' })), /explicit/);

      assert.deepEqual(records.map(({ outcome }) => outcome), ['unknown']);
    });
  }

  for (const failure of ['membership', 'target'] as const) {
    test(`Given a ${failure} read that fails before any change, when the actor asks for a change, then the failure reaches the caller, the record says that it failed, and the directory changes nothing`, async () => {
      const { directory, records, administration } = administrationWith();
      const outage = new Error(`${failure} read timed out`);
      if (failure === 'membership') directory.failMembershipReads(outage);
      else directory.member = async () => { throw outage; };

      await assert.rejects(administration.changeGrant(actorOf('user-eve'), changeOf(directory, { target: 'user-dora', role: 'user', action: 'grant' })), outage);

      assert.deepEqual(directory.grantChanges, []);
      assert.deepEqual(recordLines(records), ['user-eve in org-a: grant user for membership-user-dora-org-a: failed']);
    });
  }
});
