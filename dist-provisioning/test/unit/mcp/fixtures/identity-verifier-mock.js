import { InvalidAccessTokenError, } from '../../../../src/mcp/identity-verifier.js';
export class IdentityVerifierMock {
    calls = [];
    tokens;
    constructor(tokens = new Map()) {
        this.tokens = tokens;
    }
    async verifyAccessToken(token) {
        this.calls.push(token);
        const result = this.tokens.get(token);
        if (result === undefined)
            throw new InvalidAccessTokenError('Unknown access token');
        if (result instanceof Error)
            throw result;
        return result;
    }
}
//# sourceMappingURL=identity-verifier-mock.js.map