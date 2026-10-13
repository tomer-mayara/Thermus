import { OAuthError, OAuthErrorCode, } from '@modelcontextprotocol/server';
import { InvalidAccessTokenError } from './identity-verifier.js';
export class IdentityVerifierSdkAdapter {
    verifier;
    reportUnexpectedFailure;
    constructor(verifier, reportUnexpectedFailure) {
        this.verifier = verifier;
        this.reportUnexpectedFailure = reportUnexpectedFailure;
    }
    async verifyAccessToken(token) {
        const identity = await this.verifiedIdentity(token);
        if (!establishesHumanUser(identity))
            throw invalidToken();
        return {
            token,
            clientId: identity.clientId,
            scopes: [...identity.scopes],
            expiresAt: identity.expiresAtUnixSeconds,
            resource: new URL(identity.resource.href),
            extra: verifiedClaims(identity),
        };
    }
    async verifiedIdentity(token) {
        try {
            return await this.verifier.verifyAccessToken(token);
        }
        catch (error) {
            if (error instanceof InvalidAccessTokenError)
                throw invalidToken();
            this.reportUnexpectedFailure(error);
            throw error;
        }
    }
}
export function verifiedUserOf(authInfo) {
    const user = authInfo.extra?.user;
    if (!isUsableUser(user))
        throw new Error('AuthInfo has no verified user');
    return user;
}
function invalidToken() {
    return new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
}
function establishesHumanUser(identity) {
    return isUsableUser(identity.user)
        && isText(identity.issuer)
        && isText(identity.clientId)
        && identity.clientId !== identity.user.subject
        && Number.isFinite(identity.issuedAtUnixSeconds)
        && Number.isFinite(identity.expiresAtUnixSeconds)
        && identity.resource instanceof URL
        && Array.isArray(identity.scopes);
}
function isUsableUser(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const { authority, subject, selectedOrganizationId } = value;
    return isText(authority) && isText(subject) && (selectedOrganizationId === undefined || isText(selectedOrganizationId));
}
function isText(value) {
    return typeof value === 'string' && value !== '';
}
function verifiedClaims(identity) {
    const { authority, subject, selectedOrganizationId } = identity.user;
    return Object.freeze({
        user: Object.freeze({ authority, subject, ...(selectedOrganizationId === undefined ? {} : { selectedOrganizationId }) }),
        issuer: identity.issuer,
        clientId: identity.clientId,
        scopes: Object.freeze([...identity.scopes]),
        issuedAt: identity.issuedAtUnixSeconds,
        expiresAt: identity.expiresAtUnixSeconds,
        audience: identity.resource.href,
    });
}
//# sourceMappingURL=identity-verifier-sdk-adapter.js.map