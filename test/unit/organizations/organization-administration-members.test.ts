import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MemberOverview } from '../../../src/organizations/administration-overviews.ts';
import type { OrganizationMember } from '../../../src/organizations/organization-directory.ts';
import { actorOf, administrationWith, superAdminGrant, userGrant } from './fixtures/administration-fixtures.ts';

function overviewOf(overview: MemberOverview | string): MemberOverview {
  assert.notEqual(typeof overview, 'string', `the overview was refused: ${String(overview)}`);
  return overview as MemberOverview;
}

function changesOf(overview: MemberOverview): Record<string, string[]> {
  return Object.fromEntries(overview.members.map(({ email, changes }) => [email, changes.map(({ action, role }) => `${action} ${role}`)]));
}

describe('OrganizationAdministration members and the User seat summary', () => {
  test('Given members on several pages, when an Admin asks for the overview, then it reads each page with explicit statuses, lists each member of the organization with its application roles, and counts each active membership with User once', async () => {
    const { directory, administration } = administrationWith();

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.equal(overview.activeUserSeats, 3);
    assert.deepEqual(overview.members.map(({ email, status, roles }) => `${email} ${status} ${roles.join('+') || '-'}`), [
      'sam@example.com active super-admin',
      'otto@example.com active user+admin+super-admin',
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

  test('Given an Admin, a Super Admin, and a member with both, when each asks for the overview, then each active member offers only the changes of the authority of the actor, and inactive and pending members offer none', async () => {
    const { administration } = administrationWith();

    const [eve, sam, otto] = await Promise.all(['user-eve', 'user-sam', 'user-otto'].map(async (subject) => overviewOf(await administration.memberOverview(actorOf(subject), 'org-a'))));

    assert.deepEqual(changesOf(eve as MemberOverview)['cy@example.com'], ['revoke user']);
    assert.deepEqual(changesOf(eve as MemberOverview)['dora@example.com'], ['grant user']);
    assert.deepEqual(changesOf(sam as MemberOverview)['cy@example.com'], ['revoke admin']);
    assert.deepEqual(changesOf(sam as MemberOverview)['sam@example.com'], ['grant admin']);
    assert.deepEqual(changesOf(otto as MemberOverview)['una@example.com'], ['revoke user', 'grant admin']);
    for (const overview of [eve, sam, otto] as MemberOverview[]) {
      assert.deepEqual([changesOf(overview)['ivy@example.com'], changesOf(overview)['pia@example.com']], [[], []]);
    }
  });

  test('Given a member that is repeated on two pages, also with a changed status on the later page, when the overview is read, then each membership is listed and counted once, and its later record decides', async () => {
    const { directory, administration } = administrationWith();
    const deactivated = (member: OrganizationMember): OrganizationMember => ({ ...member, status: 'inactive' });
    directory.memberPageLayout = (members) => [members.slice(0, 3), [members[2] as OrganizationMember, deactivated(members[1] as OrganizationMember)], members.slice(3)];

    const overview = overviewOf(await administration.memberOverview(actorOf('user-eve'), 'org-a'));

    assert.deepEqual(overview.members.map(({ email }) => email).filter((email) => ['otto@example.com', 'cy@example.com'].includes(email)), ['otto@example.com', 'cy@example.com']);
    assert.equal(overview.members.length, 8);
    assert.equal(overview.members[1]?.status, 'inactive');
    assert.equal(overview.activeUserSeats, 2);
  });

  test('Given only members with Admin, Super Admin, or the default role, and members with User that are inactive or pending, when the overview is read, then no seat is counted', async () => {
    const { administration } = administrationWith([
      { subject: 'user-sam', organizationId: 'org-a', grants: [superAdminGrant] },
      { subject: 'user-eve', organizationId: 'org-a', grants: [{ role: 'admin', permissions: ['user-grants:manage'] }] },
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

    assert.deepEqual([overview.members.length, overview.activeUserSeats], [8, 3]);
  });

  for (const { label, actor, organizationId, refusal } of [
    { label: 'a User without Admin or Super Admin', actor: actorOf('user-una'), organizationId: 'org-a', refusal: 'denied' },
    { label: 'an Admin of another organization', actor: actorOf('user-ben'), organizationId: 'org-a', refusal: 'denied' },
    { label: 'an Admin with an inactive membership', actor: actorOf('user-ivy'), organizationId: 'org-a', refusal: 'denied' },
    { label: 'an Admin whose sign-in did not complete MFA', actor: actorOf('user-eve', false), organizationId: 'org-a', refusal: 'mfa-required' },
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

    assert.deepEqual([overview, overview.members, first, first?.roles, first?.changes, first?.changes[0]].map(Object.isFrozen), [true, true, true, true, true, true]);
  });
});
