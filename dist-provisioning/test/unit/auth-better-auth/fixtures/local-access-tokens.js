import { generateKeyPairSync, sign } from 'node:crypto';
export const localIssuer = 'http://localhost:8080/api/auth';
export const mcpResourceUrl = 'http://localhost:8080/mcp';
// Signs JWTs as the provider's jwt() plugin does, with Ed25519 by default, so each test runs the real verification path.
export class AccessTokenSigner {
    publicKey;
    privateKey;
    constructor(kid, algorithm = 'EdDSA') {
        const { privateKey, publicKey } = algorithm === 'EdDSA'
            ? generateKeyPairSync('ed25519')
            : generateKeyPairSync('ec', { namedCurve: 'P-256' });
        this.privateKey = privateKey;
        this.publicKey = { ...publicKey.export({ format: 'jwk' }), kid, alg: algorithm };
    }
    // A JWS has the raw form of an ECDSA signature, not DER. Ed25519 ignores the encoding.
    sign(claims, header = {}) {
        const { alg, kid } = this.publicKey;
        const signed = `${encoded({ alg, typ: 'at+jwt', kid, ...header })}.${encoded(claims)}`;
        const signature = sign(alg === 'EdDSA' ? null : 'sha256', Buffer.from(signed), { key: this.privateKey, dsaEncoding: 'ieee-p1363' });
        return `${signed}.${signature.toString('base64url')}`;
    }
}
// The claims of a user token from the authorization code grant. A change with the value undefined removes the claim.
export function localUserClaims(changes = {}) {
    const issuedAt = Math.floor(Date.now() / 1_000);
    return {
        iss: localIssuer,
        sub: 'user-1',
        aud: [mcpResourceUrl, `${localIssuer}/oauth2/userinfo`],
        azp: 'native-client',
        client_id: 'native-client',
        scope: 'openid profile',
        sid: 'session-1',
        iat: issuedAt,
        exp: issuedAt + 3_600,
        jti: 'token-1',
        ...changes,
    };
}
// Keeps the original signature, as an attacker who changes the claims of a token must do.
export function withChangedClaims(token, changes) {
    const [header = '', payload = '', signature = ''] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return [header, encoded({ ...claims, ...changes }), signature].join('.');
}
function encoded(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}
//# sourceMappingURL=local-access-tokens.js.map