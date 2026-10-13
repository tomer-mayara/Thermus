export class BillingFree {
    async stateOf(organizationId) {
        if (typeof organizationId !== 'string' || organizationId === '') {
            throw new TypeError('Billing needs an organization ID');
        }
        return Object.freeze({ organizationId, plan: 'free', billedSeats: 0 });
    }
    async updateSeats(organizationId, seatCount) {
        if (!Number.isSafeInteger(seatCount) || seatCount < 0) {
            throw new RangeError('A seat count must be a whole number of 0 or more');
        }
        return this.stateOf(organizationId);
    }
}
//# sourceMappingURL=billing-free.js.map