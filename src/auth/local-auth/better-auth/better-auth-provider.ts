import { encodeBasicCredentials, verifyJwsAccessToken } from 'better-auth/oauth2';
import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../access-context.ts';
import { CLIENT_ADDRESS_HEADER } from '../../../http/client-address.ts';
import { InvalidAccessTokenError, type IdentityVerifier, type VerifiedIdentity } from '../../identity-verifier.ts';
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

export const LOCAL_USER_GRANT: RoleGrant = Object.freeze({ role: 'user', permissions: Object.freeze(['product:access']) });

type TokenPayload = Awaited<ReturnType<typeof verifyJwsAccessToken>>;

interface ProviderUser {
  readonly id: string;
  readonly banned?: boolean | null;
}

interface AccessClaims {
  readonly issuer: string;
  readonly subject: string;
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly issuedAt: number;
  readonly expiresAt: number;
}

const COMPACT_JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;
// jose gives these codes when the key set cannot verify any token, not when one token is bad.
const KEY_SET_FAILURES = new Set(['ERR_JWKS_INVALID', 'ERR_JWKS_MULTIPLE_MATCHING_KEYS', 'ERR_JWKS_TIMEOUT']);
const MISSING_CLIENT_MESSAGE = 'No resource-server client is registered for the MCP resource of this PUBLIC_BASE_URL, '
  + 'so no access token can be checked. Run `thermus clients register` to register it.';
const SERVER_PROCESS_ADDRESS = '127.0.0.1';
const ACCOUNT_INACTIVE: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });

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

  // The local check comes first. Introspection answers 500 for a changed payload, the key of another installation,
  // or alg none, so without it a forged token would look like a provider outage.
  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    if (!COMPACT_JWT.test(token)) throw new InvalidAccessTokenError('The access token is not a compact JWT');
    const claims = accessClaimsOf(await this.signedPayload(token));
    await this.requireActive(token);
    return {
      user: { authority: this.authority, subject: claims.subject },
      issuer: claims.issuer,
      clientId: claims.clientId,
      scopes: claims.scopes,
      issuedAtUnixSeconds: claims.issuedAt,
      expiresAtUnixSeconds: claims.expiresAt,
      resource: new URL(this.settings.mcpResourceUrl),
    };
  }

  // The local edition has one workspace and no organizations, so a selected organization has no effect.
  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    if (user.authority !== this.authority) return ACCOUNT_INACTIVE;
    const { internalAdapter } = await this.auth.$context;
    if (!isEnabled(await internalAdapter.findUserById(user.subject))) return ACCOUNT_INACTIVE;
    return {
      allowed: true,
      context: createRequestContext({
        user: { authority: this.authority, subject: user.subject },
        tenantId: this.tenantId,
        grants: [LOCAL_USER_GRANT],
      }),
    };
  }

  // The provider's own key set, read in the process: the check makes no network request.
  private async signedPayload(token: string): Promise<TokenPayload> {
    try {
      return await verifyJwsAccessToken(token, {
        jwksFetch: () => this.keySet(),
        verifyOptions: { issuer: this.settings.issuer, audience: this.settings.mcpResourceUrl, typ: 'at+jwt', algorithms: ['EdDSA'] },
      });
    } catch (error) {
      if (isTokenRejection(error)) throw new InvalidAccessTokenError('The access token failed the JWT check');
      throw error;
    }
  }

  // The wrapper keeps a failed read, also a TypeError, from looking like a rejected token.
  private async keySet() {
    try {
      return await this.auth.api.getJwks();
    } catch (error) {
      throw new Error('The provider could not read its key set', { cause: error });
    }
  }

  // Only introspection knows if the browser session of the token still exists.
  private async requireActive(token: string): Promise<void> {
    const client = this.settings.resourceServerClient;
    if (client === undefined) throw new Error(MISSING_CLIENT_MESSAGE);
    const response = await this.auth.handler(introspectionRequest(this.settings.issuer, client, token));
    if (!await activeStateOf(response)) throw new InvalidAccessTokenError('The access token is not active');
  }
}

function introspectionRequest(issuer: string, client: ResourceServerClient, token: string): Request {
  return new Request(`${issuer}/oauth2/introspect`, {
    method: 'POST',
    headers: {
      Authorization: encodeBasicCredentials(client.clientId, client.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      [CLIENT_ADDRESS_HEADER]: SERVER_PROCESS_ADDRESS,
    },
    body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
  });
}

// Each message names only the status: the body of a refusal can repeat request data.
async function activeStateOf(response: Response): Promise<boolean> {
  if (response.status !== 200) throw new Error(`Token introspection failed with HTTP ${response.status}`);
  const result: unknown = await response.json().catch(() => undefined);
  const active = typeof result === 'object' && result !== null ? (result as { active?: unknown }).active : undefined;
  if (typeof active !== 'boolean') throw new Error('Token introspection answered HTTP 200 without an active state');
  return active;
}

// Each jose error code starts with ERR_J. jose throws a TypeError when the protected header of the token does not decode.
function isTokenRejection(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('ERR_J') && !KEY_SET_FAILURES.has(code);
}

// A local user token always has the browser session in sid. Introspection checks no session for a token without sid.
function accessClaimsOf(payload: TokenPayload): AccessClaims {
  const { iss, sub, sid, client_id: clientId, scope, iat, exp } = payload;
  if (!isText(iss) || !isText(sub) || !isText(sid) || !isText(clientId) || typeof scope !== 'string' || !isTime(iat) || !isTime(exp)) {
    throw new InvalidAccessTokenError('The access token does not have the claims of a local user token');
  }
  const scopes = scope.split(' ').filter((part) => part !== '');
  return { issuer: iss, subject: sub, clientId, scopes, issuedAt: iat, expiresAt: exp };
}

// The local edition bans without an expiry, so a ban stays until the operator lifts it.
function isEnabled(user: ProviderUser | null): boolean {
  return user !== null && user.banned !== true;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
