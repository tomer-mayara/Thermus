import type { Billing, BillingState } from './billing.ts';

// The 5 members of a free organization, the creator included (decision D-5).
const FREE_MEMBER_LIMIT = 5;

export class BillingFree implements Billing {
  async stateOf(organizationId: string): Promise<BillingState> {
    if (typeof organizationId !== 'string' || organizationId === '') {
      throw new TypeError('Billing needs an organization ID');
    }
    return Object.freeze({ organizationId, plan: 'free', memberLimit: FREE_MEMBER_LIMIT, billedSeats: 0 });
  }

  async updateSeats(organizationId: string, seatCount: number): Promise<BillingState> {
    if (!Number.isSafeInteger(seatCount) || seatCount < 0) {
      throw new RangeError('A seat count must be a whole number of 0 or more');
    }
    return this.stateOf(organizationId);
  }
}
