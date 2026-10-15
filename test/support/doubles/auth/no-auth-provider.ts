import type { AccessDecision, AccessResolver, AuthenticatedUser } from '../../../../src/auth/access-context.ts';
import type { IdentityVerifier, VerifiedIdentity } from '../../../../src/auth/identity-verifier.ts';

export class NoAuthProvider implements IdentityVerifier, AccessResolver {
  constructor(private readonly resource: URL) {}

  async verifyAccessToken(_token: string): Promise<VerifiedIdentity> {
    const now = Math.floor(Date.now() / 1_000);
    return {
      user: syntheticUser(),
      issuer: 'https://synthetic-auth.thermus.invalid',
      clientId: 'synthetic-mcp-client',
      resource: new URL(this.resource),
      scopes: [],
      issuedAtUnixSeconds: now,
      expiresAtUnixSeconds: now + 300,
    };
  }

  async resolve(_user: AuthenticatedUser): Promise<AccessDecision> {
    return { allowed: true, context: {
      user: syntheticUser(),
      tenantId: 'synthetic-workspace',
      grants: [{ role: 'user', permissions: ['product:access'] }],
      permissions: ['product:access'],
    } };
  }
}

function syntheticUser(): AuthenticatedUser {
  return { authority: 'https://synthetic-auth.thermus.invalid', subject: 'synthetic-user' };
}
