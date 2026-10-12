import {
  InvalidAccessTokenError,
  type IdentityVerifier,
  type VerifiedIdentity,
} from '../../../../src/mcp/identity-verifier.ts';

export class IdentityVerifierMock implements IdentityVerifier {
  readonly calls: string[] = [];
  private readonly tokens: ReadonlyMap<string, VerifiedIdentity | Error>;

  constructor(tokens: ReadonlyMap<string, VerifiedIdentity | Error> = new Map()) {
    this.tokens = tokens;
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    this.calls.push(token);
    const result = this.tokens.get(token);
    if (result === undefined) throw new InvalidAccessTokenError('Unknown access token');
    if (result instanceof Error) throw result;
    return result;
  }
}
