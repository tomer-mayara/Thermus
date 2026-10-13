import type { Billing, BillingState } from './billing.ts';

export class BillingFree implements Billing {
  async stateOf(_organizationId: string): Promise<BillingState> {
    throw new Error('BillingFree is not implemented');
  }

  async updateSeats(_organizationId: string, _seats: number): Promise<BillingState> {
    throw new Error('BillingFree is not implemented');
  }
}
