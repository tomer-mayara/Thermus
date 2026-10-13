export class AccessResolverMock {
    calls = [];
    decisions;
    constructor(decisions = new Map()) {
        this.decisions = decisions;
    }
    async resolve(user) {
        this.calls.push(user);
        const configured = this.decisions.get(user.subject);
        if (configured === undefined)
            return { allowed: false, reason: 'account-inactive' };
        if (configured instanceof Error)
            throw configured;
        if (typeof configured === 'function')
            return configured(user);
        return configured;
    }
}
//# sourceMappingURL=access-resolver-mock.js.map