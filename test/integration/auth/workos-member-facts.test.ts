import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSOrganizations, workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { workosAuthority } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { membershipJson } from '../../support/doubles/workos/workos-fake-wire.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';

const organizationId = 'org_FACTS';
const user = { id: 'user_FACTS', email: 'facts@example.com', firstName: 'Facts' };

for (const evidence of [false, true, undefined, null]) {
  test(`Given raw WorkOS management evidence ${String(evidence)}, when the pinned client reads a facts page, then it retains the raw safety facts, exact filters and cursor without a user request`, async t => {
    const world = await WorkOSFake.start(t, hostedConfig.publicBaseUrl, [organizationId]);
    world.users = [user];
    world.memberships = [{ userId: user.id, organizationId, roles: ['user', 'admin', 'member', 'super-admin'], directoryManaged: false }];
    const membershipId = world.membershipId(user, organizationId);
    const initial = membershipJson({ ...world.memberships[0], id: membershipId, status: 'active', organizationName: 'Facts', changes: 0 });
    const { directory_managed: _management, ...withoutManagement } = initial;
    let raw: unknown = initial;
    world.fake.answer(`GET /user_management/organization_memberships/${membershipId}`, () => ({ status: 200, body: raw }));
    world.fake.answer('GET /user_management/organization_memberships', () => ({ status: 200, body: { object: 'list', data: [raw], list_metadata: { before: null, after: 'next-members' } } }));
    const { workos, settings } = world.connection();
    const directory = new WorkOSOrganizations({ authority: workosAuthority(settings.clientId), memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
    const before = await directory.member(membershipId);
    raw = evidence === undefined ? withoutManagement : { ...withoutManagement, directory_managed: evidence };
    const direct = await directory.member(membershipId);
    assert.ok(direct);
    const { email: _email, ...expected } = direct;
    world.fake.takeRequests();

    const page = await directory.memberFactsPage({ organizationId, statuses: ['active', 'inactive', 'pending'], cursor: 'prior-members' });

    assert.deepEqual(page, { items: [expected], next: 'next-members' });
    assert.equal(page.items[0]?.management, evidence === false ? 'ordinary' : evidence === true ? 'external' : 'unknown');
    assert.equal(page.items[0]?.revision === before?.revision, evidence === false);
    assert.deepEqual(page.items[0]?.grants.map(grant => grant.role), ['user', 'admin', 'member', 'super-admin']);
    assert.deepEqual(world.fake.takeRequests().map(({ method, path }) => `${method} ${path}`), [
      `GET /user_management/organization_memberships?organization_id=${organizationId}&statuses=active%2Cinactive%2Cpending&limit=100&after=prior-members&order=desc`,
      `GET /authorization/organizations/${organizationId}/roles`,
    ]);
  });
}
