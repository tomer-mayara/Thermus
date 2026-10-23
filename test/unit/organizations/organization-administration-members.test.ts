import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MemberOverview } from '../../../src/accounts/organizations/administration-overviews.ts';
import type { OrganizationMember } from '../../../src/accounts/organizations/organization-directory.ts';
import { actorOf, administrationWith, superAdminGrant, userGrant } from './fixtures/administration-fixtures.ts';

function overviewOf(overview: MemberOverview | string): MemberOverview {
  assert.notEqual(typeof overview, 'string', `the overview was refused: ${String(overview)}`);
  return overview as MemberOverview;
}

describe('OrganizationAdministration members and the product member count', () => {
  test('Given an Admin actor with no MFA evidence, when the actor reads members and invites either role, then current permission reads authorize each operation', async () => {
    const { administration, directory } = administrationWith([
      { subject: 'user-admin', organizationId: 'org-a', grants: [{ role: 'admin', permissions: ['product:access', 'user-grants:manage', 'admin-grants:manage', 'billing:manage'] }] },
    ]);
    const actor = { user: { authority: 'hosted-provider-double', subject: 'user-admin', selectedOrganizationId: 'org-a' } };

    const overview = overviewOf(await administration.memberOverview(actor, 'org-a'));
    assert.equal(overview.activeUserSeats, 1);
    for (const role of ['user', 'admin']) {
      assert.equal(await administration.sendInvitation(actor, { organizationId: 'org-a', email: `${role}@example.com`, role }), 'applied');
    }
    assert.deepEqual(directory.membershipReads, [actor.user, actor.user, actor.user]);
  });

  test('Given members on several pages, when an Admin asks for the overview, then it reads each page with explicit statuses, lists each member of the organization with its application roles, and counts each active product membership once', async () => {
    const { directory, administration } = administrationWith();

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.equal(overview.activeUserSeats, 5);
    assert.deepEqual(overview.members.map(({ email, status, roles }) => `${email} ${status} ${roles.join('+') || '-'}`), [
      'sam@example.com active admin',
      'otto@example.com active user+admin',
      'cy@example.com active user+admin',
      'eve@example.com active admin',
      'una@example.com active user',
      'ivy@example.com inactive user+admin',
      'pia@example.com pending user',
      'dora@example.com active -',
    ]);
    assert.deepEqual(directory.memberPageReads.map(({ organizationId, statuses, cursor }) => `${organizationId} ${statuses.join()} ${cursor ?? 'first'}`), [
      'org-a active,inactive,pending first',
      'org-a active,inactive,pending page-1',
      'org-a active,inactive,pending page-2',
      'org-a active,inactive,pending page-3',
    ]);
  });

  test('Given a member that is repeated on two pages, also with a changed status on the later page, when the overview is read, then each membership is listed and counted once, and its later record decides', async () => {
    const { directory, administration } = administrationWith();
    const deactivated = (member: OrganizationMember): OrganizationMember => ({ ...member, status: 'inactive' });
    directory.memberPageLayout = (members) => [members.slice(0, 3), [members[2] as OrganizationMember, deactivated(members[1] as OrganizationMember)], members.slice(3)];

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.deepEqual(overview.members.map(({ email }) => email).filter((email) => ['otto@example.com', 'cy@example.com'].includes(email)), ['otto@example.com', 'cy@example.com']);
    assert.equal(overview.members.length, 8);
    assert.equal(overview.members[1]?.status, 'inactive');
    assert.equal(overview.activeUserSeats, 4);
  });

  test('Given memberships with a synthetic user-manager grant, a retired role, or the default role, and inactive or pending product members, when the overview is read, then no product member is counted', async () => {
    const { administration } = administrationWith([
      { subject: 'user-sam', organizationId: 'org-a', grants: [superAdminGrant] },
      { subject: 'user-eve', organizationId: 'org-a', grants: [{ role: 'test-user-manager', permissions: ['user-grants:manage'] }] },
      { subject: 'user-ivy', organizationId: 'org-a', grants: [userGrant], status: 'inactive' },
      { subject: 'user-pia', organizationId: 'org-a', grants: [userGrant], status: 'pending' },
      { subject: 'user-dora', organizationId: 'org-a', grants: [{ role: 'member', permissions: [] }] },
    ]);

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.equal(overview.activeUserSeats, 0);
  });

  test('Given a page that fails after earlier pages were read, when the overview is read, then the failure reaches the caller and no partial count is given', async () => {
    const { directory, administration } = administrationWith();
    const outage = new Error('member page 2 timed out');
    directory.memberPageLayout = (members) => [members.slice(0, 2), outage, members.slice(4)];

    await assert.rejects(administration.memberOverview(actorOf('user-eve'), 'org-a'), outage);

    assert.equal(directory.memberPageReads.length, 2);
  });

  for (const [label, next] of [['a cursor that the directory gave before', 'page-0'], ['a page that names itself as the next page', 'page-1']] as const) {
    test(`Given a directory that gives ${label}, when the overview is read, then the read fails instead of reading pages without end`, async () => {
      const { directory, administration } = administrationWith();
      directory.memberPage = async (request) => {
        directory.memberPageReads.push(request);
        return { items: [], next: request.cursor === undefined ? 'page-1' : next };
      };

      await assert.rejects(administration.memberOverview(actorOf('user-eve'), 'org-a'), /repeated a page cursor/);

      assert.ok(directory.memberPageReads.length <= 3);
    });
  }

  test('Given a directory that gives a new cursor for each page without end, when the overview is read, then the read fails at the page limit', async () => {
    const { directory, administration } = administrationWith();
    let reads = 0;
    directory.memberPage = async () => {
      reads += 1;
      return { items: [], next: `page-${reads}` };
    };

    await assert.rejects(administration.memberOverview(actorOf('user-eve'), 'org-a'), /more than 1000 pages/);

    assert.equal(reads, 1_000);
  });

  test('Given a page record of another organization, when the overview is read, then that record is neither listed nor counted', async () => {
    const { directory, administration } = administrationWith();
    directory.memberPageLayout = (members) => [members, [{ ...(members[2] as OrganizationMember), membershipId: 'membership-user-cy-org-b', organizationId: 'org-b' }]];

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.deepEqual([overview.members.length, overview.activeUserSeats], [8, 5]);
  });

  for (const { label, actor, organizationId, refusal } of [
    { label: 'a User without Admin', actor: actorOf('user-una'), organizationId: 'org-a', refusal: 'denied' },
    { label: 'an Admin of another organization', actor: actorOf('user-ben'), organizationId: 'org-a', refusal: 'denied' },
    { label: 'an Admin with an inactive membership', actor: actorOf('user-ivy'), organizationId: 'org-a', refusal: 'denied' },
  ]) {
    test(`Given ${label}, when it asks for the overview, then it is refused as ${refusal}, and no member page is read`, async () => {
      const { directory, records, administration } = administrationWith();

      const overview = await administration.memberOverview(actor, organizationId);

      assert.equal(overview, refusal);
      assert.deepEqual([directory.memberPageReads, records], [[], []]);
    });
  }

  test('Given an overview, when the directory changes later, then the overview stays as it was read: each part of it is frozen', async () => {
    const { administration } = administrationWith();

    const overview = overviewOf(await administration.memberOverview(actorOf('user-otto'), 'org-a'));
    const [first] = overview.members;

    assert.deepEqual([overview, overview.members, first, first?.roles].map(Object.isFrozen), [true, true, true, true]);
  });
});
