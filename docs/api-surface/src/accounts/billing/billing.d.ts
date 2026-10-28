export type BillingState = {
    readonly organizationId: string;
    readonly plan: 'free';
    readonly memberLimit: number;
    readonly billedSeats: number;
} | {
    readonly organizationId: string;
    readonly plan: 'team';
    readonly billedSeats: number;
};
export interface Billing {
    stateOf(organizationId: string): Promise<BillingState>;
    updateSeats(organizationId: string, seatCount: number): Promise<BillingState>;
}
