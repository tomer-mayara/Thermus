import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MembershipRecord } from '../../support/doubles/organizations/membership-directory-double.ts';
import { administrationMembers, authority, member, members, userOf } from '../../support/fixtures/hosted-members.ts';

const userGrant = { role: 'user', permissions: ['product:access'] };

function rolesIn(record: MembershipRecord): readonly string[] {
  return record.grants.map(({ role }) => role);
}

function subjectsIn(memberships: readonly MembershipRecord[], organizationId: string): readonly string[] {
  return memberships.filter((record) => record.organizationId === organizationId).map(({ subject }) => subject);
}

function activeUsersIn(memberships: readonly MembershipRecord[], organizationId: string): readonly string[] {
  return subjectsIn(memberships.filter((record) => record.active && rolesIn(record).includes('user')), organizationId);
}

describe('Hosted members of the offline organization and administration tests', () => {
  test('Given each of the five organizations of the tests, when member() makes a membership in it, then the membership is active, has the given grants, and has the name of that organization: Acme, Globex, Initech, Umbrella, or Hooli', () => {
    const names = { 'org-a': 'Acme', 'org-b': 'Globex', 'org-c': 'Initech', 'org-d': 'Umbrella', 'org-e': 'Hooli' };

    for (const [organizationId, organizationName] of Object.entries(names)) {
      assert.deepEqual(member('user-kim', organizationId, [userGrant]), { subject: 'user-kim', organizationId, organizationName, active: true, grants: [userGrant] });
    }
  });

  test('Given an organization that is not one of the five, when member() makes a membership in it, then the organization name is the organization ID', () => {
    assert.equal(member('user-kim', 'org-z', [userGrant]).organizationName, 'org-z');
  });

  test('Given only a subject, when userOf() makes a user, then the user has the authority of the provider double, hosted-provider-double, and no selectedOrganizationId', () => {
    assert.equal(authority, 'hosted-provider-double');
    assert.deepEqual(userOf('user-kim'), { authority: 'hosted-provider-double', subject: 'user-kim' });
  });

  test('Given a subject and an organization, when userOf() makes a user, then the user has that organization as selectedOrganizationId', () => {
    assert.deepEqual(userOf('user-kim', 'org-b'), { authority: 'hosted-provider-double', subject: 'user-kim', selectedOrganizationId: 'org-b' });
  });

  test('Given the memberships of the organization tests, when they are read, then nora has no membership, mia is a User in Acme, an Admin in Globex, and inactive in Initech, and otto is the only member of Umbrella', () => {
    const mia = members.filter(({ subject }) => subject === 'user-mia');

    assert.deepEqual(members.filter(({ subject }) => subject === 'user-nora'), []);
    assert.deepEqual(mia.map((record) => [record.organizationName, record.active ? rolesIn(record) : 'inactive']), [['Acme', ['user']], ['Globex', ['admin']], ['Initech', 'inactive']]);
    assert.deepEqual(subjectsIn(members, 'org-d'), ['user-otto']);
  });

  test('Given the memberships of the administration tests, when the active memberships with User are listed, then Acme has 4: otto, cy, fay, and una, and Globex has 3: cy, una, and ben; the User grants of ivy, which is inactive, and of pia, which is pending, do not count', () => {
    const acmeUsersNotActive = administrationMembers.filter((record) => record.organizationId === 'org-a' && !record.active && rolesIn(record).includes('user'));

    assert.deepEqual(activeUsersIn(administrationMembers, 'org-a'), ['user-otto', 'user-cy', 'user-fay', 'user-una']);
    assert.deepEqual(activeUsersIn(administrationMembers, 'org-b'), ['user-cy', 'user-una', 'user-ben']);
    assert.deepEqual(acmeUsersNotActive.map(({ subject, status }) => [subject, status]), [['user-ivy', undefined], ['user-pia', 'pending']]);
  });
});
