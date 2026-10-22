import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ListOrganizationMembershipsOptions } from '@workos-inc/node';
import { HostedRoleConfigurationError } from '../../../src/accounts/providers/workos/hosted-role-mapping.ts';
import { WorkOSOrganizations } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { stagingRoles, type MembershipRecord, type RoleRecord } from './fixtures/workos-organizations-double.ts';

interface ReadAnswers {
  readonly memberships?: readonly MembershipRecord[];
  readonly after?: string | null;
  readonly roles?: readonly RoleRecord[];
  readonly membershipFailure?: Error;
  readonly roleFailure?: Error;
}

const authority = 'workos:client_test';
const alice = 'user_01ALICE';
const acme = 'org_01ACME';

// Access resolution never reads a member, an invitation, or an organization, and never writes a role.
const notCalled = async (): Promise<never> => assert.fail('Access resolution made a call of organization administration.');

function rolesWith(slug: string, permissions: readonly string[]): RoleRecord[] {
  return [...stagingRoles().filter((role) => role.slug !== slug), { slug, permissions }];
}

function activeMembership(roleSlugs: readonly string[] | undefined, changes: Partial<MembershipRecord> = {}): MembershipRecord {
  return {
    id: 'om_01ALICE',
    userId: alice,
    organizationId: acme,
    organizationName: 'Acme',
    status: 'active',
    updatedAt: '2026-10-14T08:00:00.000Z',
    directoryManaged: false,
    ...(roleSlugs === undefined ? {} : { roles: roleSlugs.map((slug) => ({ slug })) }),
    ...changes,
  };
}

// Records each SDK read, so that a test can check the exact query.
class WorkOSReadsDouble {
  readonly membershipReads: ListOrganizationMembershipsOptions[] = [];
  readonly roleReads: string[] = [];
  private readonly answers: ReadAnswers;

  constructor(answers: ReadAnswers) {
    this.answers = answers;
  }

  readonly userManagement = {
    listOrganizationMemberships: async (options: ListOrganizationMembershipsOptions) => {
      this.membershipReads.push(options);
      if (this.answers.membershipFailure !== undefined) throw this.answers.membershipFailure;
      return { data: this.answers.memberships ?? [], listMetadata: { before: null, after: this.answers.after ?? null } };
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
      if (this.answers.roleFailure !== undefined) throw this.answers.roleFailure;
      return { object: 'list' as const, data: this.answers.roles ?? stagingRoles() };
    },
    assignRole: notCalled,
    removeRole: notCalled,
  };

  readonly organizations = { getOrganization: notCalled };
}

function grantsWith(answers: ReadAnswers) {
  const reads = new WorkOSReadsDouble(answers);
  return { reads, grants: () => new WorkOSOrganizations({ authority, ...reads }).activeGrants(alice, acme) };
}

async function assertConfigurationError(read: Promise<unknown>, ...parts: RegExp[]): Promise<void> {
  await assert.rejects(read, (error: unknown) => {
    assert.ok(error instanceof HostedRoleConfigurationError, String(error));
    assert.equal(error.name, 'HostedRoleConfigurationError');
    for (const part of parts) assert.match(error.message, part);
    return true;
  });
}

describe('WorkOSOrganizations active grants', () => {
  test('Given only the User and Admin customer roles, when an Admin-only membership is read, then its one grant includes product and both invitation permissions and existing billing access', async () => {
    const permissions = ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'];
    const { grants } = grantsWith({
      memberships: [activeMembership(['admin'])],
      roles: [{ slug: 'user', permissions: ['product:access'] }, { slug: 'admin', permissions }],
    });

    assert.deepEqual(await grants(), [{ role: 'admin', permissions }]);
  });

  test('Given an active membership with the roles user and admin, when its grants are read, then each role gives one frozen grant with its application permissions in the order of the membership, after one exact membership read and one role read', async () => {
    const { reads, grants } = grantsWith({ memberships: [activeMembership(['user', 'admin'])] });

    const result = await grants();

    assert.deepEqual(result, [
      { role: 'user', permissions: ['product:access'] },
      { role: 'admin', permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'] },
    ]);
    assert.ok(result !== undefined && Object.isFrozen(result));
    assert.ok(result.every((grant) => Object.isFrozen(grant) && Object.isFrozen(grant.permissions)));
    assert.deepEqual(reads.membershipReads, [{ userId: alice, organizationId: acme, statuses: ['active'], limit: 10 }]);
    assert.deepEqual(reads.roleReads, [acme]);
  });

  test('Given a retired super-admin role, the default role, and User, when the grants are read, then only User gives application permissions', async () => {
    const { grants } = grantsWith({ memberships: [activeMembership(['super-admin', 'member', 'user'])] });

    assert.deepEqual(await grants(), [
      { role: 'super-admin', permissions: [] },
      { role: 'member', permissions: [] },
      { role: 'user', permissions: ['product:access'] },
    ]);
  });

  test('Given only the default role, when the grants are read, then the one grant gives no permission', async () => {
    const { grants } = grantsWith({ memberships: [activeMembership(['member'])] });

    assert.deepEqual(await grants(), [{ role: 'member', permissions: [] }]);
  });

  test('Given no active membership, when the grants are read, then the answer is undefined and the roles are not read', async () => {
    const { reads, grants } = grantsWith({ memberships: [] });

    assert.equal(await grants(), undefined);
    assert.equal(reads.membershipReads.length, 1);
    assert.deepEqual(reads.roleReads, []);
  });

  test('Given two reads of the same membership, when the grants are read, then each read asks WorkOS again, because no grant is kept', async () => {
    const reads = new WorkOSReadsDouble({ memberships: [activeMembership(['user'])] });
    const organizations = new WorkOSOrganizations({ authority, ...reads });

    await organizations.activeGrants(alice, acme);
    await organizations.activeGrants(alice, acme);

    assert.equal(reads.membershipReads.length, 2);
    assert.deepEqual(reads.roleReads, [acme, acme]);
  });

  test('Given roles with permissions that only WorkOS knows, when the grants are read, then the grants keep only application permissions and the mapping stays valid', async () => {
    const roles = [
      { slug: 'member', permissions: ['widgets:read'] },
      { slug: 'user', permissions: ['widgets:read', 'product:access'] },
      { slug: 'admin', permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage', 'widgets:write'] },
    ];
    const { grants } = grantsWith({ memberships: [activeMembership(['user', 'member'])], roles });

    assert.deepEqual(await grants(), [
      { role: 'user', permissions: ['product:access'] },
      { role: 'member', permissions: [] },
    ]);
  });

  test('Given the permissions of admin in another order, when the grants are read, then the mapping is valid', async () => {
    const roles = rolesWith('admin', ['billing:manage', 'admin-grants:manage', 'user-grants:manage', 'product:access']);
    const { grants } = grantsWith({ memberships: [activeMembership(['admin'])], roles });

    assert.deepEqual(await grants(), [{ role: 'admin', permissions: ['billing:manage', 'admin-grants:manage', 'user-grants:manage', 'product:access'] }]);
  });

  for (const { label, answers, parts } of [
    {
      label: 'a default role that gives product:access',
      answers: { memberships: [activeMembership(['member'])], roles: rolesWith('member', ['product:access']) },
      parts: [/\bmember\b/, /no application permission/],
    },
    {
      label: 'another role with an application permission',
      answers: { memberships: [activeMembership(['user'])], roles: [...stagingRoles(), { slug: 'auditor', permissions: ['billing:manage'] }] },
      parts: [/\bauditor\b/, /no application permission/],
    },
    {
      label: 'a retired super-admin role with its old application permissions',
      answers: { memberships: [activeMembership(['user'])], roles: rolesWith('super-admin', ['admin-grants:manage', 'billing:manage']) },
      parts: [/\bsuper-admin\b/, /no application permission/],
    },
    {
      label: 'no admin role',
      answers: { memberships: [activeMembership(['user'])], roles: stagingRoles().filter((role) => role.slug !== 'admin') },
      parts: [/\badmin\b/, /does not exist/],
    },
    {
      label: 'a user role without product:access',
      answers: { memberships: [activeMembership(['user'])], roles: rolesWith('user', []) },
      parts: [/\buser\b/, /exactly the application permissions product:access/],
    },
    {
      label: 'an admin role that lacks product and billing access',
      answers: { memberships: [activeMembership(['admin'])], roles: rolesWith('admin', ['user-grants:manage', 'admin-grants:manage']) },
      parts: [/\badmin\b/, /exactly the application permissions product:access, user-grants:manage/],
    },
    {
      label: 'a membership role that the organization does not have',
      answers: { memberships: [activeMembership(['user', 'ghost'])] },
      parts: [/\bghost\b/, /no role with this slug/],
    },
    {
      label: 'a membership without a role list',
      answers: { memberships: [activeMembership(undefined)] },
      parts: [/no role list/, /multiple roles/],
    },
  ] satisfies { label: string; answers: ReadAnswers; parts: RegExp[] }[]) {
    test(`Given ${label}, when the grants are read, then a HostedRoleConfigurationError names the role and the rule, and no grant is given`, async () => {
      const { grants } = grantsWith(answers);

      await assertConfigurationError(grants(), ...parts, new RegExp(acme));
    });
  }

  for (const { label, answers } of [
    { label: 'two active memberships', answers: { memberships: [activeMembership(['user']), activeMembership(['admin'])] } },
    { label: 'a cursor of a next page', answers: { memberships: [activeMembership(['user'])], after: 'om_02' } },
    { label: 'the membership of another user', answers: { memberships: [activeMembership(['user'], { userId: 'user_02BOB' })] } },
    { label: 'the membership of another organization', answers: { memberships: [activeMembership(['user'], { organizationId: 'org_02GLOBEX' })] } },
    { label: 'an inactive membership', answers: { memberships: [activeMembership(['user'], { status: 'inactive' })] } },
  ] satisfies { label: string; answers: ReadAnswers }[]) {
    test(`Given a membership read that answers ${label}, when the grants are read, then the read fails and gives no grant`, async () => {
      const { reads, grants } = grantsWith(answers);

      await assert.rejects(grants(), (error: unknown) => {
        assert.ok(error instanceof Error && !(error instanceof HostedRoleConfigurationError), String(error));
        assert.match(error.message, /WorkOS/);
        assert.doesNotMatch(error.message, /user_01ALICE|user_02BOB/);
        return true;
      });
      assert.deepEqual(reads.roleReads, []);
    });
  }

  for (const step of ['membershipFailure', 'roleFailure'] as const) {
    test(`Given a WorkOS read that fails (${step}), when the grants are read, then the same error reaches the caller, so access fails closed`, async () => {
      const failure = new Error('WorkOS answered HTTP 503');
      const { grants } = grantsWith({ memberships: [activeMembership(['user'])], [step]: failure });

      await assert.rejects(grants(), (error) => error === failure);
    });
  }
});
