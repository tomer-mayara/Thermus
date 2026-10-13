import type { AccessDecision, AccessResolver, AuthenticatedUser, RoleGrant } from '../auth/access-context.ts';
import type { IdentityVerifier, VerifiedIdentity } from '../mcp/identity-verifier.ts';
import type { LocalAuth, ResourceServerClient } from './better-auth-runtime.ts';

export interface BetterAuthProviderSettings {
  // The exact issuer of local access tokens: the provider base URL, such as http://localhost:8080/api/auth.
  readonly issuer: string;
  // Each accepted token must have this MCP resource in its audience.
  readonly mcpResourceUrl: string;
  readonly installationId: string;
  // The installation's confidential client for token introspection. Without it, no token can be checked.
  readonly resourceServerClient: ResourceServerClient | undefined;
}

// Every enabled local account gets this one grant in the one installation workspace.
export const LOCAL_USER_GRANT: RoleGrant = Object.freeze({ role: 'user', permissions: Object.freeze(['product:access']) });

export class BetterAuthProvider implements IdentityVerifier, AccessResolver {
  readonly authority: string;
  readonly tenantId: string;
  private readonly auth: LocalAuth;
  private readonly settings: BetterAuthProviderSettings;

  constructor(auth: LocalAuth, settings: BetterAuthProviderSettings) {
    this.auth = auth;
    this.settings = settings;
    this.authority = `better-auth:${settings.installationId}`;
    this.tenantId = `local:${settings.installationId}`;
  }

  async verifyAccessToken(_token: string): Promise<VerifiedIdentity> {
    throw new Error(`BetterAuthProvider cannot verify tokens of ${this.settings.issuer} yet`);
  }

  async resolve(_user: AuthenticatedUser): Promise<AccessDecision> {
    throw new Error(`BetterAuthProvider cannot resolve access with ${String(this.auth)} yet`);
  }
}
