import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { OrganizationMembership } from '@workos-inc/node';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { applicationPermissionsOf } from '../../../support/hosted-live/settings.ts';

const readOptions = { timeout: 120_000 };
const pageLimit = 2;
const maxPages = 10;

function roleSlugs(membership: OrganizationMembership): string[] {
  assert.ok(membership.roles, `The membership ${membership.id} has no roles list.`);
  return membership.roles.map(({ slug }) => slug).toSorted();
}

export function describeMembershipProofs(run: LiveRun): void {
  const { workos } = run;

  async function activeMembershipsOf(userId: string): Promise<OrganizationMembership[]> {
    const page = await workos.userManagement.listOrganizationMemberships({ userId, statuses: ['active'], limit: 100 });
    assert.equal(page.listMetadata.after ?? null, null, 'The memberships of one user do not fit on one page.');
    return page.data;
  }

  async function permissionsOfRoles(organizationId: string): Promise<Map<string, string[]>> {
    const { data } = await workos.authorization.listOrganizationRoles(organizationId);
    return new Map(data.map(({ slug, permissions }) => [slug, applicationPermissionsOf(permissions)]));
  }

  async function grantsOf(membership: OrganizationMembership): Promise<string[]> {
    const permissions = await permissionsOfRoles(membership.organizationId);
    return roleSlugs(membership).flatMap((slug) => {
      const granted = permissions.get(slug);
      assert.ok(granted, `The role ${slug} of the membership is not a role of its organization.`);
      return granted;
    }).toSorted();
  }

  describe('Hosted live proofs: membership and permission reads', () => {
    test('Given a user with User and Admin in organization A and User in organization B, when its active memberships are read, then each has its complete independent role list, and the roles of A combine product:access and user-grants:manage without a highest role', readOptions, async (t) => {
      const { twoOrganizationUser, organizationA, organizationB } = await run.fixtures();
      const memberships = await activeMembershipsOf(twoOrganizationUser.id);
      for (const membership of memberships) t.diagnostic(`membership in ${membership.organizationId === organizationA.id ? 'A' : 'B'}: status ${membership.status}, role ${membership.role.slug}, roles ${JSON.stringify(roleSlugs(membership))}`);
      const inA = memberships.find(({ organizationId }) => organizationId === organizationA.id);
      const inB = memberships.find(({ organizationId }) => organizationId === organizationB.id);

      assert.equal(memberships.length, 2);
      assert.ok(inA && inB, 'A membership is missing.');
      assert.deepEqual(roleSlugs(inA), ['admin', 'user']);
      assert.deepEqual(roleSlugs(inB), ['user']);
      assert.deepEqual(await grantsOf(inA), ['product:access', 'user-grants:manage']);
      assert.deepEqual(await grantsOf(inB), ['product:access']);
    });

    test('Given an Admin-only membership, when it is read, then its one role gives user-grants:manage and no product:access', readOptions, async (t) => {
      const { memberships } = await run.fixtures();
      const membership = await workos.userManagement.getOrganizationMembership(memberships.adminOnlyInA);
      t.diagnostic(`Admin-only membership: roles ${JSON.stringify(roleSlugs(membership))}`);

      assert.deepEqual(roleSlugs(membership), ['admin']);
      assert.deepEqual(await grantsOf(membership), ['user-grants:manage']);
    });

    test('Given a membership made without a role, when it is read, then it has only the default role member, and member gives no application permission', readOptions, async (t) => {
      const { memberships } = await run.fixtures();
      const membership = await workos.userManagement.getOrganizationMembership(memberships.defaultRoleInA);
      t.diagnostic(`membership without a role: role ${membership.role.slug}, roles ${JSON.stringify(roleSlugs(membership))}`);

      assert.deepEqual(roleSlugs(membership), ['member']);
      assert.deepEqual(await grantsOf(membership), []);
    });

    test('Given a deactivated membership, when the memberships of its user are read with the explicit status active, then none is listed; with the status inactive, it is listed as inactive with its roles', readOptions, async (t) => {
      const { memberships } = await run.fixtures();
      const membership = await workos.userManagement.getOrganizationMembership(memberships.deactivatedUserInA);
      const active = await activeMembershipsOf(membership.userId);
      const inactive = await workos.userManagement.listOrganizationMemberships({ userId: membership.userId, statuses: ['inactive'], limit: 100 });
      t.diagnostic(`deactivated membership: status ${membership.status}, roles ${JSON.stringify(roleSlugs(membership))}; active: ${active.length}; inactive: ${inactive.data.length}`);

      assert.equal(membership.status, 'inactive');
      assert.deepEqual(active, []);
      assert.deepEqual(inactive.data.map(({ id }) => id), [membership.id]);
    });

    test('Given organization A with six memberships, when they are read with the explicit statuses active and inactive and a page limit of 2, then the after cursor reads each membership exactly once, and the last page has no after cursor', readOptions, async (t) => {
      const { organizationA, memberships } = await run.fixtures();
      const inA = ['userAndAdminInA', 'connectUserInA', 'adminOnlyInA', 'defaultRoleInA', 'deactivatedUserInA', 'mixedAdminInA'] as const;
      const expected = inA.map((name) => memberships[name]).toSorted();
      const seen: string[] = [];
      const pageSizes: number[] = [];
      let after: string | undefined;
      for (let count = 0; count < maxPages; count += 1) {
        const page = await workos.userManagement.listOrganizationMemberships({ organizationId: organizationA.id, statuses: ['active', 'inactive'], limit: pageLimit, ...(after === undefined ? {} : { after }) });
        pageSizes.push(page.data.length);
        seen.push(...page.data.map(({ id }) => id));
        after = page.listMetadata.after ?? undefined;
        if (after === undefined) break;
      }
      t.diagnostic(`page sizes: ${JSON.stringify(pageSizes)}`);

      assert.equal(after, undefined, `The pages did not end after ${maxPages} reads.`);
      assert.ok(pageSizes.every((size) => size <= pageLimit), 'A page has more memberships than the limit.');
      assert.deepEqual(seen.toSorted(), expected);
    });

    test('Given the roles of organization A, when they are read, then they are the environment roles of the hosted mapping with their exact permissions', readOptions, async (t) => {
      const { organizationA } = await run.fixtures();
      const { data } = await workos.authorization.listOrganizationRoles(organizationA.id);
      for (const { slug, type, permissions } of data) t.diagnostic(`role ${slug} (${type}): ${JSON.stringify(permissions.toSorted())}`);
      const permissions = new Map(data.map(({ slug, permissions: granted }) => [slug, granted.toSorted()]));

      assert.deepEqual(permissions.get('user'), ['product:access']);
      assert.deepEqual(permissions.get('admin'), ['user-grants:manage']);
      assert.deepEqual(permissions.get('super-admin'), ['admin-grants:manage', 'billing:manage']);
      assert.deepEqual(permissions.get('member'), []);
    });
  });
}
