import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ListOrganizationMembershipsOptions } from '@workos-inc/node';
import type { AuthenticatedUser } from '../../../src/auth/access-context.ts';
import { HostedRoleConfigurationError } from '../../../src/auth/hosted-auth/workos/hosted-role-mapping.ts';
import { WorkOSOrganizations } from '../../../src/auth/hosted-auth/workos/workos-organizations.ts';
import { stagingRoles, type MembershipRecord, type RoleRecord } from './fixtures/workos-organizations-double.ts';

interface MembershipPage {
  readonly data: readonly MembershipRecord[];
  readonly listMetadata: { readonly before: string | null; readonly after: string | null };
}

const authority = 'workos:client_test';
const alice = 'user_01ALICE';
const aliceUser: AuthenticatedUser = { authority, subject: alice, selectedOrganizationId: 'org_01ACME' };
const names: Readonly<Record<string, string>> = { org_01ACME: 'Acme', org_02GLOBEX: 'Globex', org_03INITECH: 'Initech' };

// Access resolution never reads a member or an invitation and never writes a role.
const notCalled = async (): Promise<never> => assert.fail('Access resolution made a call of organization administration.');

function membership(organizationId: string, roleSlugs: readonly string[] | undefined, changes: Partial<MembershipRecord> = {}): MembershipRecord {
  return {
    id: `om_${organizationId}`,
    userId: alice,
    organizationId,
    organizationName: names[organizationId] ?? organizationId,
    status: 'active',
    updatedAt: '2026-10-14T08:00:00.000Z',
    directoryManaged: false,
    ...(roleSlugs === undefined ? {} : { roles: roleSlugs.map((slug) => ({ slug })) }),
    ...changes,
  };
}

function page(data: readonly MembershipRecord[], after: string | null = null): MembershipPage {
  return { data, listMetadata: { before: null, after } };
}

// The memberships reads of the pinned SDK client. Each read gets the page of its after cursor: page 0 without a
// cursor, and page n with the cursor "cursor-n". Each read is kept, so that a test can check the exact query.
class MembershipReadsDouble {
  readonly membershipReads: ListOrganizationMembershipsOptions[] = [];
  readonly roleReads: string[] = [];
  readonly pages: readonly MembershipPage[];
  readonly rolesByOrganization = new Map<string, readonly RoleRecord[]>();
  membershipFailure: Error | undefined;
  roleFailure: Error | undefined;

  constructor(pages: readonly MembershipPage[]) {
    this.pages = pages;
  }

  readonly userManagement = {
    listOrganizationMemberships: async (options: ListOrganizationMembershipsOptions): Promise<MembershipPage> => {
      this.membershipReads.push(options);
      if (this.membershipFailure !== undefined) throw this.membershipFailure;
      const index = options.after === undefined || options.after === null ? 0 : Number(options.after.replace('cursor-', ''));
      const answer = this.pages[index];
      assert.ok(answer, `the double has no page for the cursor ${String(options.after)}`);
      return answer;
    },
    getOrganizationMembership: notCalled,
    getUser: notCalled,
    listInvitations: notCalled,
    getInvitation: notCalled,
    sendInvitation: notCalled,
    resendInvitation: notCalled,
    revokeInvitation: notCalled,
  };

  readonly authorization = {
    listOrganizationRoles: async (organizationId: string) => {
      this.roleReads.push(organizationId);
      if (this.roleFailure !== undefined) throw this.roleFailure;
      return { object: 'list' as const, data: this.rolesByOrganization.get(organizationId) ?? stagingRoles() };
    },
    assignRole: notCalled,
    removeRole: notCalled,
  };
}

function directoryWith(pages: readonly MembershipPage[]) {
  const reads = new MembershipReadsDouble(pages);
  return { reads, organizations: new WorkOSOrganizations({ authority, ...reads }) };
}

async function assertReadFailure(read: Promise<unknown>, message: RegExp): Promise<void> {
  await assert.rejects(read, (error: unknown) => {
    assert.ok(error instanceof Error && !(error instanceof HostedRoleConfigurationError), String(error));
    assert.match(error.message, message);
    assert.doesNotMatch(error.message, /user_01ALICE|user_02BOB/);
    return true;
  });
}

describe('WorkOSOrganizations memberships of a user', () => {
  test('Given active memberships in two organizations, when the memberships of the user are read, then each maps to a frozen active membership with the WorkOS organization name and the grants of the role mapping, after one read of the user with the explicit status active and one role read for each organization', async () => {
    const { reads, organizations } = directoryWith([page([membership('org_01ACME', ['user', 'admin']), membership('org_02GLOBEX', ['super-admin'])])]);

    const result = await organizations.membershipsOf(aliceUser);

    assert.deepEqual(result, [
      { organizationId: 'org_01ACME', organizationName: 'Acme', active: true, grants: [{ role: 'user', permissions: ['product:access'] }, { role: 'admin', permissions: ['user-grants:manage'] }] },
      { organizationId: 'org_02GLOBEX', organizationName: 'Globex', active: true, grants: [{ role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] }] },
    ]);
    assert.ok(Object.isFrozen(result) && result.every((record) => Object.isFrozen(record) && Object.isFrozen(record.grants)));
    assert.deepEqual(reads.membershipReads, [{ userId: alice, statuses: ['active'], limit: 100 }]);
    assert.deepEqual(reads.roleReads, ['org_01ACME', 'org_02GLOBEX']);
  });

  test('Given memberships on three pages, when the memberships are read, then each page is read with the after cursor of the page before, and the read ends at the page without a cursor', async () => {
    const { reads, organizations } = directoryWith([
      page([membership('org_01ACME', ['user'])], 'cursor-1'),
      page([membership('org_02GLOBEX', ['admin'])], 'cursor-2'),
      page([membership('org_03INITECH', ['user'])]),
    ]);

    const result = await organizations.membershipsOf(aliceUser);

    assert.deepEqual(result.map(({ organizationId }) => organizationId), ['org_01ACME', 'org_02GLOBEX', 'org_03INITECH']);
    assert.deepEqual(reads.membershipReads, [
      { userId: alice, statuses: ['active'], limit: 100 },
      { userId: alice, statuses: ['active'], limit: 100, after: 'cursor-1' },
      { userId: alice, statuses: ['active'], limit: 100, after: 'cursor-2' },
    ]);
  });

  test('Given no active membership, when the memberships are read, then the answer is an empty frozen list and no role is read', async () => {
    const { reads, organizations } = directoryWith([page([])]);

    const result = await organizations.membershipsOf(aliceUser);

    assert.deepEqual(result, []);
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(reads.roleReads, []);
  });

  test('Given a user of another authority, such as a local account with the same subject, when its memberships are read, then it has none, and WorkOS gets no read', async () => {
    const { reads, organizations } = directoryWith([page([membership('org_01ACME', ['user'])])]);

    const result = await organizations.membershipsOf({ authority: 'local:installation-1', subject: alice, selectedOrganizationId: 'org_01ACME' });

    assert.deepEqual(result, []);
    assert.deepEqual([reads.membershipReads, reads.roleReads], [[], []]);
  });

  test('Given a membership with only the default role, when the memberships are read, then it is active with one grant that gives no permission, so that it authorizes nothing', async () => {
    const { organizations } = directoryWith([page([membership('org_01ACME', ['member'])])]);

    assert.deepEqual(await organizations.membershipsOf(aliceUser), [
      { organizationId: 'org_01ACME', organizationName: 'Acme', active: true, grants: [{ role: 'member', permissions: [] }] },
    ]);
  });

  test('Given roles with permissions that only WorkOS knows, when the memberships are read, then the grants keep only application permissions', async () => {
    const { reads, organizations } = directoryWith([page([membership('org_01ACME', ['user'])])]);
    reads.rolesByOrganization.set('org_01ACME', stagingRoles().map((role) => ({ ...role, permissions: [...role.permissions, 'widgets:read'] })));

    assert.deepEqual((await organizations.membershipsOf(aliceUser))[0]?.grants, [{ role: 'user', permissions: ['product:access'] }]);
  });

  test('Given two reads of the same user, when the memberships are read, then each read asks WorkOS again, because no membership or grant is kept', async () => {
    const { reads, organizations } = directoryWith([page([membership('org_01ACME', ['user'])])]);

    await organizations.membershipsOf(aliceUser);
    await organizations.membershipsOf(aliceUser);

    assert.equal(reads.membershipReads.length, 2);
    assert.deepEqual(reads.roleReads, ['org_01ACME', 'org_01ACME']);
  });

  for (const { label, pages, message } of [
    { label: 'an inactive membership', pages: [page([membership('org_01ACME', ['user'], { status: 'inactive' })])], message: /did not ask for/ },
    { label: 'a pending membership', pages: [page([membership('org_01ACME', ['user'], { status: 'pending' })])], message: /did not ask for/ },
    { label: 'the membership of another user', pages: [page([membership('org_01ACME', ['user'], { userId: 'user_02BOB' })])], message: /did not ask for/ },
    { label: 'a membership without an organization name', pages: [page([membership('org_01ACME', ['user'], { organizationName: '' })])], message: /org_01ACME.*without an organization name/ },
    { label: 'two active memberships in one organization', pages: [page([membership('org_01ACME', ['user'])], 'cursor-1'), page([membership('org_01ACME', ['admin'])])], message: /more than one active membership/ },
    { label: 'a repeated page cursor', pages: [page([membership('org_01ACME', ['user'])], 'cursor-1'), page([membership('org_02GLOBEX', ['user'])], 'cursor-1')], message: /repeated a page cursor/ },
  ] satisfies { label: string; pages: MembershipPage[]; message: RegExp }[]) {
    test(`Given a membership read that answers ${label}, when the memberships are read, then the read fails and gives no membership and no grant`, async () => {
      const { reads, organizations } = directoryWith(pages);

      await assertReadFailure(organizations.membershipsOf(aliceUser), message);
      assert.deepEqual(reads.roleReads, []);
    });
  }

  test('Given memberships on more than ten pages, when the memberships are read, then the read stops after ten pages and fails, so that no partial list gives access', async () => {
    const pages = Array.from({ length: 12 }, (_, index) => page([membership(`org_${index}`, ['user'])], `cursor-${index + 1}`));
    const { reads, organizations } = directoryWith(pages);

    await assertReadFailure(organizations.membershipsOf(aliceUser), /more than 10 pages/);
    assert.equal(reads.membershipReads.length, 10);
    assert.deepEqual(reads.roleReads, []);
  });

  for (const { label, records, roles, parts } of [
    { label: 'a membership without a role list', records: [membership('org_01ACME', undefined)], roles: stagingRoles(), parts: [/no role list/] },
    { label: 'a default role that gives product:access', records: [membership('org_01ACME', ['member'])], roles: stagingRoles().map((role) => (role.slug === 'member' ? { ...role, permissions: ['product:access'] } : role)), parts: [/\bmember\b/, /no application permission/] },
    { label: 'a membership role that the organization does not have', records: [membership('org_01ACME', ['user', 'ghost'])], roles: stagingRoles(), parts: [/\bghost\b/] },
  ] satisfies { label: string; records: MembershipRecord[]; roles: RoleRecord[]; parts: RegExp[] }[]) {
    test(`Given ${label}, when the memberships are read, then a HostedRoleConfigurationError names the organization and the rule, and no membership is given`, async () => {
      const { reads, organizations } = directoryWith([page([membership('org_02GLOBEX', ['user']), ...records])]);
      reads.rolesByOrganization.set('org_01ACME', roles);

      await assert.rejects(organizations.membershipsOf(aliceUser), (error: unknown) => {
        assert.ok(error instanceof HostedRoleConfigurationError, String(error));
        for (const part of [...parts, /org_01ACME/]) assert.match(error.message, part);
        return true;
      });
    });
  }

  for (const step of ['membershipFailure', 'roleFailure'] as const) {
    test(`Given a WorkOS read that fails (${step}), when the memberships are read, then the same error reaches the caller, so that a failure never looks like a user without memberships`, async () => {
      const failure = new Error('WorkOS answered HTTP 503');
      const { reads, organizations } = directoryWith([page([membership('org_01ACME', ['user'])])]);
      reads[step] = failure;

      await assert.rejects(organizations.membershipsOf(aliceUser), (error) => error === failure);
    });
  }
});
