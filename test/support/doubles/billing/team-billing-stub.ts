import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';

export class TeamBillingStub implements Billing {
  async stateOf(organizationId: string): Promise<BillingState> {
    return Object.freeze({ organizationId, plan: 'team', billedSeats: 0 });
  }

  async updateSeats(organizationId: string): Promise<BillingState> {
    return this.stateOf(organizationId);
  }
}
