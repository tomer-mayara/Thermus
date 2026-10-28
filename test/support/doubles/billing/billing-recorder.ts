import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';
import { BillingFree } from '../../../../src/accounts/billing/billing-free.ts';

// Stands at the payment boundary of the hosted composition. It keeps each call that reaches billing and gives it to the
// billing that it wraps, by default the real BillingFree, so that a test sees the counts that billing gets and the states
// that billing confirms.
export class BillingRecorder implements Billing {
  // The organization of each state read.
  readonly reads: string[] = [];
  // Each seat update as "<organization>: <count>".
  readonly updates: string[] = [];
  private readonly billing: Billing;

  constructor(billing: Billing = new BillingFree()) {
    this.billing = billing;
  }

  stateOf(organizationId: string): Promise<BillingState> {
    this.reads.push(organizationId);
    return this.billing.stateOf(organizationId);
  }

  updateSeats(organizationId: string, seatCount: number): Promise<BillingState> {
    this.updates.push(`${organizationId}: ${seatCount}`);
    return this.billing.updateSeats(organizationId, seatCount);
  }
}
