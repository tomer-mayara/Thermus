import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DirectoryGrantChange } from '../../../src/organizations/organization-directory.ts';
import {
  acme,
  assertConfigurationError,
  assertWorkOSFailure,
  globex,
  membership,
  refusal,
  roles,
  WorkOSOrganizationsDouble,
  type MembershipRecord,
} from './fixtures/workos-organizations-double.ts';

// WorkOS with this membership of Alice, readable by its ID.
function doubleWith(record: MembershipRecord): WorkOSOrganizationsDouble {
  const double = new WorkOSOrganizationsDouble();
  double.memberships.set(record.id, record);
  double.emails.set(record.userId, 'alice@example.com');
  return double;
}

// The revision that the actor saw, from a member read of the directory. The calls of this read are not part of the
// change, so the double forgets them.
async function seenRevision(double: WorkOSOrganizationsDouble, membershipId = 'om_01ALICE'): Promise<string> {
  const member = await double.directory().member(membershipId);
  assert.ok(member !== undefined);
  double.calls.length = 0;
  return member.revision;
}

function roleWrite(roleSlug: string, organizationId = acme, organizationMembershipId = 'om_01ALICE') {
  return { organizationMembershipId, roleSlug, resourceTypeSlug: 'organization', resourceExternalId: organizationId };
}

describe('WorkOSOrganizations grant changes', () => {
  test('Given an active membership with User at the revision that the actor saw, when Admin is granted, then WorkOS gets one membership read and after it exactly one assignRole of admin on the organization resource, User stays, and the result is a frozen applied', async () => {
    const double = doubleWith(membership({ roles: roles('user') }));
    const revision = await seenRevision(double);

    const result = await double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision });

    assert.deepEqual(result, { outcome: 'applied' });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(double.calls, [
      { method: 'getOrganizationMembership', input: 'om_01ALICE' },
      { method: 'assignRole', input: roleWrite('admin') },
    ]);
    assert.deepEqual(double.roleSlugsOf('om_01ALICE'), ['user', 'admin']);
  });

  test('Given an active membership in Globex with User and Admin, when User is revoked, then WorkOS gets one removeRole of user with Globex, the organization of the current membership, as the resource, and Admin stays', async () => {
    const double = doubleWith(membership({ id: 'om_02GLOBEX', organizationId: globex, organizationName: 'Globex', roles: roles('user', 'admin') }));
    const revision = await seenRevision(double, 'om_02GLOBEX');

    const result = await double.directory().changeGrant({ membershipId: 'om_02GLOBEX', role: 'user', action: 'revoke', revision });

    assert.deepEqual(result, { outcome: 'applied' });
    assert.deepEqual(double.calls, [
      { method: 'getOrganizationMembership', input: 'om_02GLOBEX' },
      { method: 'removeRole', input: roleWrite('user', globex, 'om_02GLOBEX') },
    ]);
    assert.deepEqual(double.roleSlugsOf('om_02GLOBEX'), ['admin']);
  });

  test('Given a membership whose only role is User, when User is revoked, then the final role goes with one removeRole, and WorkOS gets no replacement of the role set and no membership change', async () => {
    const double = doubleWith(membership({ roles: roles('user') }));
    const revision = await seenRevision(double);

    const result = await double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'user', action: 'revoke', revision });

    assert.deepEqual(result, { outcome: 'applied' });
    assert.deepEqual(double.calls, [
      { method: 'getOrganizationMembership', input: 'om_01ALICE' },
      { method: 'removeRole', input: roleWrite('user') },
    ]);
  });

  test('Given WorkOS answers 404 for the membership, when a grant is changed, then the result is stale, and WorkOS gets no write', async () => {
    const double = new WorkOSOrganizationsDouble();

    const result = await double.directory().changeGrant({ membershipId: 'om_09GONE', role: 'user', action: 'grant', revision: 'seen-revision' });

    assert.deepEqual(result, { outcome: 'stale' });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(double.calls, [{ method: 'getOrganizationMembership', input: 'om_09GONE' }]);
  });

  test('Given a membership that another administrator changed after the actor saw it, when the grant is changed with the old revision, then the result is stale, and WorkOS gets no write', async () => {
    const double = doubleWith(membership({ roles: roles('user') }));
    const revision = await seenRevision(double);
    double.memberships.set('om_01ALICE', membership({ roles: roles('user', 'admin'), updatedAt: '2026-10-14T09:00:00.000Z' }));

    const result = await double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision });

    assert.deepEqual(result, { outcome: 'stale' });
    assert.deepEqual(double.methods(), ['getOrganizationMembership']);
    assert.deepEqual(double.roleSlugsOf('om_01ALICE'), ['user', 'admin']);
  });

  for (const { label, changes } of [
    { label: 'an inactive membership, which a later reactivation would give the changed roles', changes: { status: 'inactive' } },
    { label: 'a pending membership, which gets its roles from its invitation', changes: { status: 'pending' } },
    { label: 'an active membership that a directory connection manages', changes: { directoryManaged: true } },
  ] satisfies { label: string; changes: Partial<MembershipRecord> }[]) {
    for (const action of ['grant', 'revoke'] as const) {
      test(`Given ${label}, at the revision that the actor saw, when a ${action} is asked for, then the result is unsupported, and WorkOS gets no write`, async () => {
        const double = doubleWith(membership({ roles: roles('user'), ...changes }));
        const revision = await seenRevision(double);

        const result = await double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'user', action, revision });

        assert.deepEqual(result, { outcome: 'unsupported' });
        assert.ok(Object.isFrozen(result));
        assert.deepEqual(double.methods(), ['getOrganizationMembership']);
        assert.deepEqual(double.roleSlugsOf('om_01ALICE'), ['user']);
      });
    }
  }

  test('Given an applied grant of Admin, when the same change is posted again with the revision from before it, then the result is stale and WorkOS gets no second write, so that a repeated post after an unknown outcome never repeats a write', async () => {
    const double = doubleWith(membership({ roles: roles('user') }));
    const change: DirectoryGrantChange = { membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision: await seenRevision(double) };
    const directory = double.directory();

    const first = await directory.changeGrant(change);
    const second = await directory.changeGrant(change);

    assert.deepEqual([first, second], [{ outcome: 'applied' }, { outcome: 'stale' }]);
    assert.deepEqual(double.methods(), ['getOrganizationMembership', 'assignRole', 'getOrganizationMembership']);
  });

  test('Given an applied revoke of User, when a grant of User is posted with the revision from before the revoke, then the result is stale, so that an old form never returns a grant that someone revoked', async () => {
    const double = doubleWith(membership({ roles: roles('user', 'admin') }));
    const revision = await seenRevision(double);
    const directory = double.directory();

    const revoke = await directory.changeGrant({ membershipId: 'om_01ALICE', role: 'user', action: 'revoke', revision });
    const grant = await directory.changeGrant({ membershipId: 'om_01ALICE', role: 'user', action: 'grant', revision });

    assert.deepEqual([revoke, grant], [{ outcome: 'applied' }, { outcome: 'stale' }]);
    assert.deepEqual(double.roleSlugsOf('om_01ALICE'), ['admin']);
    assert.deepEqual(double.methods(), ['getOrganizationMembership', 'removeRole', 'getOrganizationMembership']);
  });

  for (const { action, method } of [{ action: 'grant', method: 'assignRole' }, { action: 'revoke', method: 'removeRole' }] as const) {
    test(`Given a WorkOS ${method} write that fails, when a ${action} is asked for, then the same error reaches the caller after the one write, and nothing repeats it, so that the service records an unknown outcome`, async () => {
      const failure = refusal('server_error', 503);
      const double = doubleWith(membership({ roles: roles('user') }));
      const revision = await seenRevision(double);
      double.failures.set(method, failure);

      await assert.rejects(double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action, revision }), (error) => error === failure);
      assert.deepEqual(double.methods(), ['getOrganizationMembership', method]);
    });
  }

  for (const { label, failure } of [
    { label: '500', failure: refusal('server_error', 500) },
    { label: '400', failure: refusal('invalid_request', 400) },
  ]) {
    test(`Given a membership read that fails with ${label}, when a grant is changed, then the same error reaches the caller, and WorkOS gets no write`, async () => {
      const double = doubleWith(membership());
      double.failures.set('getOrganizationMembership', failure);

      await assert.rejects(double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision: 'seen-revision' }), (error) => error === failure);
      assert.deepEqual(double.methods(), ['getOrganizationMembership']);
    });
  }

  test('Given WorkOS answers a membership with another ID, when a grant is changed, then the change fails, and WorkOS gets no write', async () => {
    const double = new WorkOSOrganizationsDouble();
    double.memberships.set('om_01ALICE', membership({ id: 'om_02OTHER' }));

    await assertWorkOSFailure(double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision: 'seen-revision' }), /did not ask for/);
    assert.deepEqual(double.methods(), ['getOrganizationMembership']);
  });

  test('Given a membership without a role list, when a grant is changed, then a HostedRoleConfigurationError names the rule, and WorkOS gets no write', async () => {
    const double = new WorkOSOrganizationsDouble();
    double.memberships.set('om_01ALICE', membership({ roles: undefined }));

    await assertConfigurationError(double.directory().changeGrant({ membershipId: 'om_01ALICE', role: 'admin', action: 'grant', revision: 'seen-revision' }), /no role list/);
    assert.deepEqual(double.methods(), ['getOrganizationMembership']);
  });
});
