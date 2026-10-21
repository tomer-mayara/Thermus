import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';

// Stands for the billing package at its public contract. It keeps each call and answers with a frozen free state, or
// with the configured failure.
export class BillingDouble implements Billing {
  readonly stateReads: string[] = [];
  // Each seat update as "<organization>: <count>".
  readonly seatUpdates: string[] = [];
  private failure?: Error;

  // Makes each later call reject with this failure, or answer again with undefined.
  failWith(failure: Error | undefined): void {
    this.failure = failure;
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
    return Object.freeze({ organizationId, plan: 'free', billedSeats: 0 });
  }
}
