// The confirmed billing state of an organization. A free organization has a member limit: its active members with
// product access and its pending invitations stay at or under it. A team organization has no member limit.
export type BillingState =
  | { readonly organizationId: string; readonly plan: 'free'; readonly memberLimit: number; readonly billedSeats: number }
  | { readonly organizationId: string; readonly plan: 'team'; readonly billedSeats: number };

export interface Billing {
  stateOf(organizationId: string): Promise<BillingState>;
  updateSeats(organizationId: string, seatCount: number): Promise<BillingState>;
}
