export interface BillingState {
  readonly organizationId: string;
  readonly plan: 'free';
  readonly billedSeats: number;
}

export interface Billing {
  stateOf(organizationId: string): Promise<BillingState>;
  /** `seats` is the complete count of active User seats, not a change. A rejection confirms nothing. */
  updateSeats(organizationId: string, seats: number): Promise<BillingState>;
}
