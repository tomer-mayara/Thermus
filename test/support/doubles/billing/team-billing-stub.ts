import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';

// Stands at the payment boundary for organizations on the team plan, which has no member limit. It answers each read
// with a frozen team state and keeps no call, so that a case about another rule meets no member limit.
export class TeamBillingStub implements Billing {
  async stateOf(organizationId: string): Promise<BillingState> {
    return Object.freeze({ organizationId, plan: 'team', billedSeats: 0 });
  }

  async updateSeats(organizationId: string): Promise<BillingState> {
    return this.stateOf(organizationId);
  }
}
