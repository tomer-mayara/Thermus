import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';

type Plan = { readonly plan: 'team' } | { readonly plan: 'free'; readonly memberLimit: number };

// Stands for the billing package at its public contract. It keeps each call and answers with a frozen state of its
// plan, or with the configured failure. The plan is team, which has no member limit, until a case sets another, so
// that only the member limit cases meet a limit.
export class BillingDouble implements Billing {
  readonly stateReads: string[] = [];
  // Each seat update as "<organization>: <count>".
  readonly seatUpdates: string[] = [];
  private failure?: Error;
  private plan: Plan = { plan: 'team' };

  // Makes each later call reject with this failure, or answer again with undefined.
  failWith(failure: Error | undefined): void {
    this.failure = failure;
  }

  // Each later answer has this plan.
  answerWith(plan: Plan): void {
    this.plan = plan;
  }

  async stateOf(organizationId: string): Promise<BillingState> {
    this.stateReads.push(organizationId);
    return this.answer(organizationId);
  }

  async updateSeats(organizationId: string, seatCount: number): Promise<BillingState> {
    this.seatUpdates.push(`${organizationId}: ${seatCount}`);
    return this.answer(organizationId);
  }

  private answer(organizationId: string): BillingState {
    if (this.failure !== undefined) throw this.failure;
    return Object.freeze({ organizationId, ...this.plan, billedSeats: 0 });
  }
}
