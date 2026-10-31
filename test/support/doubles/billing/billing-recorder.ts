import type { Billing, BillingState } from '../../../../src/accounts/billing/billing.ts';
import { BillingFree } from '../../../../src/accounts/billing/billing-free.ts';

export class BillingRecorder implements Billing {
  readonly reads: string[] = [];
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
