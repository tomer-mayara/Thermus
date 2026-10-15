import type { AccessDecision, AccessResolver, AuthenticatedUser } from '../../../../src/auth/access-context.ts';

export type ConfiguredAccess = AccessDecision | Error | ((user: AuthenticatedUser) => Promise<AccessDecision>);

export class AccessResolverMock implements AccessResolver {
  readonly calls: AuthenticatedUser[] = [];
  private readonly decisions: ReadonlyMap<string, ConfiguredAccess>;

  constructor(decisions: ReadonlyMap<string, ConfiguredAccess> = new Map()) {
    this.decisions = decisions;
  }

  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    this.calls.push(user);
    const configured = this.decisions.get(user.subject);
    if (configured === undefined) return { allowed: false, reason: 'account-inactive' };
    if (configured instanceof Error) throw configured;
    if (typeof configured === 'function') return configured(user);
    return configured;
  }
}
