import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BillingState } from '../../../src/accounts/billing/billing.ts';
import { BillingFree } from '../../../src/accounts/billing/billing-free.ts';

const freeOrgA: BillingState = { organizationId: 'org-a', plan: 'free', memberLimit: 5, billedSeats: 0 };
const missingOrganization = { name: 'TypeError', message: 'Billing needs an organization ID' };
const invalidSeatCount = { name: 'RangeError', message: 'A seat count must be a whole number of 0 or more' };

async function assertRefused(call: () => Promise<BillingState>, expected: object): Promise<void> {
  const pending = call();
  assert.ok(pending instanceof Promise, 'Billing refuses input with a rejected promise, not a synchronous throw');
  await assert.rejects(pending, expected);
}

describe('BillingFree input', () => {
  for (const organizationId of ['', undefined]) {
    test(`Given ${organizationId === '' ? 'an empty' : 'no'} organization ID, when billing is read or updated, then billing rejects the call and confirms no state`, async () => {
      const billing = new BillingFree();

      await assertRefused(() => billing.stateOf(organizationId as string), missingOrganization);
      await assertRefused(() => billing.updateSeats(organizationId as string, 3), missingOrganization);
    });
  }

  for (const seats of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    test(`Given a seat count of ${seats}, when billing gets it, then billing rejects it and confirms no state`, async () => {
      await assertRefused(() => new BillingFree().updateSeats('org-a', seats), invalidSeatCount);
    });
  }

  test('Given 0 seats or the largest safe whole number of seats, when billing gets the count, then it confirms the free plan with no billed seat', async () => {
    const billing = new BillingFree();

    for (const seats of [0, Number.MAX_SAFE_INTEGER]) {
      assert.deepEqual(await billing.updateSeats('org-a', seats), freeOrgA, `${seats} seats`);
    }
  });
});

describe('BillingFree plan', () => {
  test('Given any organization, when its billing is read, then it is on the free plan with the member limit 5 and no billed seat, also after a seat count', async () => {
    const billing = new BillingFree();

    const states = [await billing.stateOf('org-a'), await billing.stateOf('org-b'), await billing.updateSeats('org-a', 9)];

    assert.deepEqual(states.map(({ organizationId, plan, billedSeats, ...limit }) => [organizationId, plan, billedSeats, limit]), [
      ['org-a', 'free', 0, { memberLimit: 5 }],
      ['org-b', 'free', 0, { memberLimit: 5 }],
      ['org-a', 'free', 0, { memberLimit: 5 }],
    ]);
  });
});

describe('BillingFree state records', () => {
  test('Given a confirmed state, when a caller tries to change it, then the record is frozen and keeps the free state', async () => {
    const billing = new BillingFree();

    for (const state of [await billing.stateOf('org-a'), await billing.updateSeats('org-a', 4)]) {
      assert.ok(Object.isFrozen(state));
      assert.throws(() => {
        (state as { billedSeats: number }).billedSeats = 4;
      }, TypeError);
      assert.throws(() => {
        (state as { memberLimit: number }).memberLimit = 50;
      }, TypeError);
      assert.deepEqual(state, freeOrgA);
    }
  });
});
