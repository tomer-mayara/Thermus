export interface BillingState {
  readonly organizationId: string;
  readonly plan: 'free';
  readonly billedSeats: number;
}

export interface Billing {
  stateOf(organizationId: string): Promise<BillingState>;
  updateSeats(organizationId: string, seatCount: number): Promise<BillingState>;
}
