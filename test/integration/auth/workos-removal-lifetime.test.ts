import assert from 'node:assert/strict';
import test from 'node:test';
import { OrganizationAdministration } from '../../../src/accounts/organizations/organization-administration.ts';
import type { RemovalIntent, RemovalOperationStore } from '../../../src/accounts/organizations/removal-operation-store.ts';
import { WorkOSOrganizations, type WorkOSOrganizationsOptions } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { hostedRolePermissions } from '../../support/fixtures/hosted-roles.ts';

type ReadStage = 'actor-pages' | 'target-roles' | 'member-users';

for (const stage of ['actor-pages', 'target-roles', 'member-users'] satisfies ReadStage[]) {
  for (const stop of ['deadline', 'close'] as const) {
    test(`Given removal paused during WorkOS ${stage}, when ${stop} stops its owner, then an in-flight read can finish but no next provider read or DELETE starts`, async t => {
      let now = 0;
      t.mock.method(performance, 'now', () => now);
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const reached = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      t.after(() => release.resolve());
      const reads: string[] = [];
      const actor = { authority: 'workos:test', subject: 'admin-a' };
      const record = (id: string) => ({ id: `member-${id}`, userId: `admin-${id}`, organizationId: 'org-a', organizationName: 'A', status: 'active' as const, updatedAt: '2026-10-25T00:00:00Z', directoryManaged: false, roles: [{ slug: 'admin' }] });
      let roleReads = 0;
      let userReads = 0;
      let deletes = 0;
      const pause = async (name: string, shouldPause: boolean) => {
        reads.push(name);
        if (shouldPause) { reached.resolve(); await release.promise; }
      };
      const unused = async (): Promise<never> => { throw new Error('Unexpected provider operation'); };
      const options: WorkOSOrganizationsOptions = {
        authority: actor.authority,
        memberships: {
          listOrganizationMemberships: async query => {
            await pause(query.userId ? 'actor-list' : 'member-list', stage === 'actor-pages' && query.after === undefined);
            const data = query.userId ? [query.after ? { ...record('a'), organizationId: 'org-b' } : record('a')] : [record('a'), record('b')];
            return { data, listMetadata: { after: stage === 'actor-pages' && query.after === undefined ? 'next-page' : undefined } };
          },
          getOrganizationMembership: async () => { await pause('target-read', false); return record('b'); },
        },
        authorization: { listOrganizationRoles: async () => {
          roleReads++;
          await pause('roles', stage === 'target-roles' && roleReads === 3);
          return { data: Object.entries(hostedRolePermissions).map(([slug, permissions]) => ({ slug, permissions })) };
        } },
        userManagement: {
          getUser: async () => { userReads++; await pause('user', stage === 'member-users' && userReads === 2); return { email: 'member@example.com' }; },
          deleteOrganizationMembership: async () => { deletes++; },
          listInvitations: unused, getInvitation: unused, sendInvitation: unused, resendInvitation: unused, revokeInvitation: unused,
        },
      };
      const directory = new WorkOSOrganizations(options);
      const target = await directory.member('member-b');
      assert.ok(target);
      const revision = target.revision;
      reads.length = 0;
      roleReads = 0;
      userReads = 0;
      let intent: RemovalIntent | undefined;
      let completions = 0;
      const store: RemovalOperationStore = {
        admitRemoval: async admitted => { intent = admitted; return { status: 'admitted' }; },
        completeRemoval: async () => { completions++; return { status: 'completed' }; },
        readRemoval: async () => ({ status: 'absent' }),
      };
      const administration = new OrganizationAdministration({ directory, removalStore: store, records: { record: () => {} }, billing: { stateOf: unused, updateSeats: unused } });
      t.after(() => administration.close());
      const removing = administration.removeMember({ user: actor }, { organizationId: 'org-a', membershipId: 'member-b', revision });
      await reached.promise;
      const readsAtStop = [...reads];
      if (stop === 'close') await administration.close();
      else { now = 30_000; t.mock.timers.tick(30_000); }
      assert.equal(await removing, stage === 'actor-pages' ? 'unavailable' : 'unknown');
      release.resolve();
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(reads, readsAtStop, 'Only the already-started provider read may finish after stop');
      assert.equal(intent === undefined, stage === 'actor-pages');
      assert.equal(completions, 0, 'A stopped owner must keep any admitted hold');
      assert.equal(deletes, 0, 'No stopped continuation may dispatch DELETE');
    });
  }
}
