import {
  InvalidAccessTokenError,
  type IdentityVerifier,
  type VerifiedIdentity,
} from '../../../../src/auth/identity-verifier.ts';

export type ConfiguredClaims = { readonly [Claim in keyof VerifiedIdentity]?: unknown };

export class IdentityVerifierMock implements IdentityVerifier {
  readonly calls: string[] = [];
  private readonly tokens: ReadonlyMap<string, ConfiguredClaims | Error>;

  constructor(tokens: ReadonlyMap<string, ConfiguredClaims | Error> = new Map()) {
    this.tokens = tokens;
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    this.calls.push(token);
    const result = this.tokens.get(token);
    if (result === undefined) throw new InvalidAccessTokenError('Unknown access token');
    if (result instanceof Error) throw result;
    return result as VerifiedIdentity;
  }
}
