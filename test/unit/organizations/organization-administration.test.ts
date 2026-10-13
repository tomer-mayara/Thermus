import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AuthenticatedUser, RoleGrant } from '../../../src/auth/access-context.ts';
import { OrganizationAdministration, type OrganizationMembership } from '../../../src/organizations/organization-administration.ts';
import { OrganizationDirectoryDouble } from './fixtures/organization-directory-double.ts';

const authority = 'hosted-provider-double';
const userGrant: RoleGrant = { role: 'user', permissions: ['product:access'] };
const adminGrant: RoleGrant = { role: 'admin', permissions: ['user-grants:manage'] };
const superAdminGrant: RoleGrant = { role: 'super-admin', permissions: ['admin-grants:manage', 'billing:manage'] };
const memberRole: RoleGrant = { role: 'member', permissions: [] };

function userOf(subject: string, selectedOrganizationId?: string): AuthenticatedUser {
  return { authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) };
}

function membership(organizationId: string, grants: readonly RoleGrant[], active = true): OrganizationMembership {
  return { organizationId, organizationName: `Organization ${organizationId.slice(-1).toUpperCase()}`, active, grants };
}

const miaMemberships: readonly OrganizationMembership[] = [
  membership('org-a', [userGrant]),
  membership('org-b', [adminGrant, memberRole]),
  membership('org-c', [userGrant, adminGrant], false),
  membership('org-d', [memberRole]),
  membership('org-e', []),
  membership('org-f', [superAdminGrant]),
];

function administrationWith(memberships: ReadonlyMap<string, readonly OrganizationMembership[] | Error>) {
  const directory = new OrganizationDirectoryDouble(memberships);
  return { directory, administration: new OrganizationAdministration({ directory, records: { record: () => assert.fail('a read keeps no change record') } }) };
}

describe('OrganizationAdministration', () => {
  test('Given a user without any membership, when the organizations are listed, then the list is empty, so the user gets the onboarding guidance and no default organization', async () => {
    const { directory, administration } = administrationWith(new Map());
    const nora = userOf('user-nora');

    const organizations = await administration.listOrganizations(nora);

    assert.deepEqual(organizations, []);
    assert.deepEqual(directory.membershipReads, [nora]);
  });

  test('Given active memberships with application permissions, an inactive membership, and active memberships whose roles grant no application permission, when the organizations are listed, then only the active memberships with a permission are listed, in directory order', async () => {
    const { administration } = administrationWith(new Map([['user-mia', miaMemberships]]));

    const organizations = await administration.listOrganizations(userOf('user-mia'));

    assert.deepEqual(organizations, [
      { organizationId: 'org-a', organizationName: 'Organization A', selected: false },
      { organizationId: 'org-b', organizationName: 'Organization B', selected: false },
      { organizationId: 'org-f', organizationName: 'Organization F', selected: false },
    ]);
  });

  for (const { label, selectedOrganizationId, selected } of [
    { label: 'an authorized active organization', selectedOrganizationId: 'org-b', selected: ['org-b'] },
    { label: 'an organization with an inactive membership', selectedOrganizationId: 'org-c', selected: [] },
    { label: 'an organization whose role grants no application permission', selectedOrganizationId: 'org-d', selected: [] },
    { label: 'an organization without a membership', selectedOrganizationId: 'org-x', selected: [] },
    { label: 'no organization', selectedOrganizationId: undefined, selected: [] },
  ]) {
    test(`Given a session that selected ${label}, when the organizations are listed, then ${selected.length === 0 ? 'no organization is' : 'only that organization is'} marked as selected`, async () => {
      const { administration } = administrationWith(new Map([['user-mia', miaMemberships]]));

      const organizations = await administration.listOrganizations(userOf('user-mia', selectedOrganizationId));

      assert.deepEqual(organizations.filter((organization) => organization.selected).map(({ organizationId }) => organizationId), selected);
      assert.deepEqual(organizations.map(({ organizationId }) => organizationId), ['org-a', 'org-b', 'org-f']);
    });
  }

  test('Given memberships that change between two lists, when the organizations are listed again, then the second list reads the current memberships, and the first list does not change', async () => {
    const { directory, administration } = administrationWith(new Map([['user-mia', miaMemberships]]));
    const mia = userOf('user-mia', 'org-a');

    const first = await administration.listOrganizations(mia);
    directory.configure('user-mia', [membership('org-a', [userGrant], false), membership('org-c', [userGrant])]);
    const second = await administration.listOrganizations(mia);

    assert.deepEqual(first.map(({ organizationId }) => organizationId), ['org-a', 'org-b', 'org-f']);
    assert.deepEqual(second, [{ organizationId: 'org-c', organizationName: 'Organization C', selected: false }]);
    assert.deepEqual([Object.isFrozen(first), Object.isFrozen(first[0])], [true, true]);
    assert.equal(directory.membershipReads.length, 2);
  });

  test('Given an authorized active membership, when its organization is requested for selection, then the organization from the current directory read is given', async () => {
    const { directory, administration } = administrationWith(new Map([['user-mia', miaMemberships]]));
    const mia = userOf('user-mia', 'org-a');

    const organization = await administration.authorizeSelection(mia, 'org-b');

    assert.deepEqual(organization, { organizationId: 'org-b', organizationName: 'Organization B', selected: false });
    assert.deepEqual(directory.membershipReads, [mia]);
  });

  for (const { label, organizationId } of [
    { label: 'an inactive membership', organizationId: 'org-c' },
    { label: 'a membership whose role grants no application permission', organizationId: 'org-d' },
    { label: 'a membership without any grant', organizationId: 'org-e' },
    { label: 'an organization of another user only', organizationId: 'org-z' },
    { label: 'an unknown organization', organizationId: 'org-unknown' },
    { label: 'an empty organization ID', organizationId: '' },
    { label: 'an organization ID in another letter case', organizationId: 'ORG-A' },
  ]) {
    test(`Given a selection request for ${label}, when the selection is checked, then it is refused`, async () => {
      const { directory, administration } = administrationWith(new Map([
        ['user-mia', miaMemberships],
        ['user-otto', [membership('org-z', [userGrant, adminGrant, superAdminGrant])]],
      ]));
      const mia = userOf('user-mia', 'org-a');

      const organization = await administration.authorizeSelection(mia, organizationId);

      assert.equal(organization, undefined);
      assert.deepEqual(directory.membershipReads, [mia]);
    });
  }

  test('Given a membership that becomes inactive after the list, when its organization is requested for selection, then the current read refuses it', async () => {
    const { directory, administration } = administrationWith(new Map([['user-mia', miaMemberships]]));
    const mia = userOf('user-mia', 'org-a');

    const listed = await administration.listOrganizations(mia);
    directory.configure('user-mia', miaMemberships.map((record) => (record.organizationId === 'org-b' ? { ...record, active: false } : record)));
    const organization = await administration.authorizeSelection(mia, 'org-b');

    assert.ok(listed.some(({ organizationId }) => organizationId === 'org-b'));
    assert.equal(organization, undefined);
  });

  test('Given a directory read that fails, when the organizations are listed or a selection is checked, then the failure reaches the caller unchanged and no organization is given', async () => {
    const outage = new Error('organization directory timed out');
    const { administration } = administrationWith(new Map([['user-mia', outage]]));
    const mia = userOf('user-mia', 'org-a');

    await assert.rejects(administration.listOrganizations(mia), outage);
    await assert.rejects(administration.authorizeSelection(mia, 'org-a'), outage);
  });
});
