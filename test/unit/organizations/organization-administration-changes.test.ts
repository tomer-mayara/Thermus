import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationSendResult } from '../../../src/accounts/organizations/organization-directory.ts';
import { actorOf, invitationsWith, recordLines } from './fixtures/administration-fixtures.ts';

const request = { organizationId: 'org-a', email: 'new@example.com', role: 'user' };

describe('OrganizationAdministration invitation failure records', () => {
  for (const afterChange of [true, false]) {
    test(`Given an invitation send that fails ${afterChange ? 'after' : 'before'} its effect, when the actor retries after a current read, then the unknown outcome is recorded and an existing pending invitation is not sent again`, async () => {
      const { directory, records, administration } = invitationsWith();
      const timeout = new Error('directory send timed out');
      directory.queue('sendInvitation', { error: timeout, afterChange });

      await assert.rejects(administration.sendInvitation(actorOf('user-eve'), request), timeout);
      const retried = await administration.sendInvitation(actorOf('user-eve'), request);

      assert.equal(retried, afterChange ? 'unchanged' : 'applied');
      assert.equal(directory.invitationChanges.length, afterChange ? 1 : 2);
      assert.deepEqual(recordLines(records), [
        'user-eve in org-a: invite user for new@example.com: unknown',
        `user-eve in org-a: invite user for new@example.com: ${retried}`,
      ]);
    });
  }

  for (const [label, answer] of [['no result', undefined], ['an unknown result', { outcome: 'probably-applied' }], ['a result without an outcome', {}]] as const) {
    test(`Given a directory that gives ${label}, when an invitation is sent, then no success is inferred and the record says unknown`, async () => {
      const { directory, records, administration } = invitationsWith();
      directory.sendInvitation = async () => answer as unknown as InvitationSendResult;

      await assert.rejects(administration.sendInvitation(actorOf('user-eve'), request), /explicit/);

      assert.deepEqual(records.map(({ outcome }) => outcome), ['unknown']);
    });
  }

  for (const failure of ['membership', 'invitation'] as const) {
    test(`Given a failed ${failure} read before a revoke, when it is requested, then no provider change runs and the record says failed`, async () => {
      const { directory, records, administration } = invitationsWith();
      const outage = new Error(`${failure} read timed out`);
      if (failure === 'membership') directory.failMembershipReads(outage);
      else directory.invitation = async () => { throw outage; };

      await assert.rejects(administration.revokeInvitation(actorOf('user-eve'), { organizationId: 'org-a', invitationId: 'invitation-1' }), outage);

      assert.deepEqual(directory.invitationChanges, []);
      assert.deepEqual(records.map(({ outcome }) => outcome), ['failed']);
    });
  }
});
