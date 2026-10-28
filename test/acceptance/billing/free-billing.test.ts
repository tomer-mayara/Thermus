import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Billing, BillingState } from '../../../src/accounts/billing/billing.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';

// A free organization has the member limit 5: its active members with product access and its pending invitations.
function freeState(organizationId: string): BillingState {
  return { organizationId, plan: 'free', memberLimit: 5, billedSeats: 0 };
}

describe('Free billing until the owner chooses a payment provider', () => {
  test('Given a new hosted organization, when its billing is read, then it is on the free plan with the member limit 5 and no seat is billed', async () => {
    const billing: Billing = new BillingFree();

    assert.deepEqual(await billing.stateOf('org-a'), freeState('org-a'));
  });

  test('Given active User seats that go from 3 to 5, then to 4, and then to 0, when billing gets each count, then each update confirms the free plan with no billed seat', async () => {
    const billing: Billing = new BillingFree();

    for (const seats of [3, 5, 4, 0]) {
      assert.deepEqual(await billing.updateSeats('org-a', seats), freeState('org-a'), `${seats} seats`);
    }
    assert.deepEqual(await billing.stateOf('org-a'), freeState('org-a'));
  });

  test('Given a seat count that arrives again or after a newer count, when billing gets it, then the result does not change', async () => {
    const billing: Billing = new BillingFree();
    const first = await billing.updateSeats('org-a', 5);

    const repeated = await billing.updateSeats('org-a', 5);
    const older = await billing.updateSeats('org-a', 3);

    assert.deepEqual([repeated, older], [first, first]);
  });

  test('Given two organizations, when one changes its seats, then the other keeps its own free state', async () => {
    const billing: Billing = new BillingFree();

    const [changed, other] = await Promise.all([billing.updateSeats('org-a', 7), billing.stateOf('org-b')]);

    assert.deepEqual(changed, freeState('org-a'));
    assert.deepEqual(other, freeState('org-b'));
  });
});
