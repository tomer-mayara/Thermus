import assert from 'node:assert/strict';
import { test } from 'node:test';
import { membership, refusal, WorkOSOrganizationsDouble } from './fixtures/workos-organizations-double.ts';

const membershipId = 'om_01ALICE';

test('Given a membership ID and a normal void SDK completion, when the directory deletes it, then it reports applied after only one exact-ID deletion', async () => {
  const double = new WorkOSOrganizationsDouble();
  double.memberships.set(membershipId, membership());

  const result = await double.directory().deleteMembership(membershipId);

  assert.deepEqual(result, { outcome: 'applied' });
  assert.deepEqual(double.calls, [{ method: 'deleteOrganizationMembership', input: membershipId }]);
});

test('Given the documented directory-managed 422 refusal, when the directory deletes a membership, then it reports unsupported without effect and does not repeat the write', async () => {
  const double = new WorkOSOrganizationsDouble();
  double.memberships.set(membershipId, membership({ directoryManaged: true }));
  double.failures.set('deleteOrganizationMembership', refusal('organization_membership_directory_managed', 422));

  const result = await double.directory().deleteMembership(membershipId);

  assert.deepEqual(result, { outcome: 'unsupported' });
  assert.equal(double.memberships.has(membershipId), true);
  assert.deepEqual(double.calls, [{ method: 'deleteOrganizationMembership', input: membershipId }]);
});

for (const failure of [
  refusal('server_error', 500),
  refusal('invalid_request', 400),
  refusal('entity_not_found', 404),
  refusal('other_refusal', 422),
  refusal('organization_membership_directory_managed', 400),
  new Error('Request timeout'),
  new Error('Response lost after dispatch'),
]) {
  test(`Given ${failure.message}, when deletion fails, then the same error reaches the caller with an uncertain effect and one SDK attempt`, async () => {
    const double = new WorkOSOrganizationsDouble();
    double.failures.set('deleteOrganizationMembership', failure);

    await assert.rejects(double.directory().deleteMembership(membershipId), (error) => error === failure);

    assert.deepEqual(double.calls, [{ method: 'deleteOrganizationMembership', input: membershipId }]);
  });
}
