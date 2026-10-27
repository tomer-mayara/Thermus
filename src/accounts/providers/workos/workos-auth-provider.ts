import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../identity/access-context.ts';
import { InvalidAccessTokenError, type IdentityVerifier, type VerifiedIdentity } from '../../identity/identity-verifier.ts';

// The fresh read of the current grants of one user in one organization. No active membership gives undefined.
interface ActiveGrantReader {
  activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined>;
}

export interface WorkOSTokenVerifierOptions {
  // The one authority of the WorkOS environment, from workosAuthority(). The client ID of an MCP client never changes it.
  readonly authority: string;
  // Exactly as written: each Connect access token must carry this issuer.
  readonly authkitIssuer: string;
  // Each Connect access token must have this MCP resource as its audience.
  readonly mcpResourceUrl: string;
  // The AuthKit key set. In production: createRemoteJWKSet(<authkitIssuer>/oauth2/jwks).
  readonly keySet: JWTVerifyGetKey;
}

export interface WorkOSAuthProviderOptions extends WorkOSTokenVerifierOptions {
  readonly grants: ActiveGrantReader;
  // Optional display data. Failure keeps access and the ID; production uses the SDK timeout and zero retries.
  readonly userManagement?: { getUser(userId: string): Promise<unknown> };
}

interface ConnectClaims {
  readonly issuer: string;
  readonly subject: string;
  readonly clientId: string;
  readonly organizationId: string | undefined;
  readonly scopes: readonly string[];
  readonly issuedAt: number;
  readonly expiresAt: number;
}

const CLOCK_TOLERANCE_SECONDS = 60;
// A Connect user token has the consent in sid. An M2M token has no sid.
const REQUIRED_CLAIMS = ['sub', 'sid', 'client_id', 'scope', 'iat', 'exp'];
// jose gives these codes, and each ERR_JWT_ and ERR_JWS_ code, for a fault of the token. Each other failure, such as
// a key-set outage, is unexpected.
const TOKEN_FAULT_CODES: ReadonlySet<string> = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
]);
const ACCOUNT_INACTIVE: AccessDecision = Object.freeze({ allowed: false, reason: 'account-inactive' });
const ORGANIZATION_REQUIRED: AccessDecision = Object.freeze({ allowed: false, reason: 'organization-required' });
const MEMBERSHIP_INACTIVE: AccessDecision = Object.freeze({ allowed: false, reason: 'membership-inactive' });

// Only the authority and the organization make the tenant, so one organization has one tenant for each credential.
export function hostedTenantId(authority: string, organizationId: string): string {
  return `${authority}:${organizationId}`;
}

// The check of a Connect token alone, with no membership read. A tenant uses it: the signed access context of the
// control plane gives the grants there.
export class WorkOSTokenVerifier implements IdentityVerifier {
  private readonly options: WorkOSTokenVerifierOptions;

  constructor(options: WorkOSTokenVerifierOptions) {
    this.options = options;
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    const claims = connectClaimsOf(await this.signedPayload(token));
    const { authority, mcpResourceUrl } = this.options;
    const { subject, organizationId } = claims;
    return {
      user: { authority, subject, ...(organizationId === undefined ? {} : { selectedOrganizationId: organizationId }) },
      issuer: claims.issuer,
      clientId: claims.clientId,
      scopes: claims.scopes,
      issuedAtUnixSeconds: claims.issuedAt,
      expiresAtUnixSeconds: claims.expiresAt,
      resource: new URL(mcpResourceUrl),
    };
  }

  // A token fault gives no cause: a jose error can hold the claims of the token.
  private async signedPayload(token: string): Promise<JWTPayload> {
    const { keySet, authkitIssuer, mcpResourceUrl } = this.options;
    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer: authkitIssuer,
        audience: mcpResourceUrl,
        algorithms: ['RS256'],
        requiredClaims: REQUIRED_CLAIMS,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
      return payload;
    } catch (error) {
      if (isTokenFault(error)) throw new InvalidAccessTokenError('The access token failed the JWT check');
      throw error;
    }
  }
}

export class WorkOSAuthProvider implements IdentityVerifier, AccessResolver {
  private readonly options: WorkOSAuthProviderOptions;
  private readonly tokens: WorkOSTokenVerifier;

  constructor(options: WorkOSAuthProviderOptions) {
    this.options = options;
    this.tokens = new WorkOSTokenVerifier(options);
  }

  verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    return this.tokens.verifyAccessToken(token);
  }

  // Each call checks the current membership and grants before it builds the access context.
  // Each operation checks its required permission against that context.
  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    const { authority, grants } = this.options;
    if (user.authority !== authority) return ACCOUNT_INACTIVE;
    const organizationId = user.selectedOrganizationId;
    if (organizationId === undefined || organizationId === '') return ORGANIZATION_REQUIRED;
    const activeGrants = await grants.activeGrants(user.subject, organizationId);
    if (activeGrants === undefined) return MEMBERSHIP_INACTIVE;
    const name = await this.userName(user.subject);
    const trustedUser = { authority, subject: user.subject, selectedOrganizationId: organizationId, ...(name === undefined ? {} : { name }) };
    return {
      allowed: true,
      context: createRequestContext({ user: trustedUser, tenantId: hostedTenantId(authority, organizationId), organizationId, grants: activeGrants }),
    };
  }

  private async userName(subject: string): Promise<string | undefined> {
    try {
      const profile = await this.options.userManagement?.getUser(subject);
      return profileNameOf(profile, subject);
    } catch {
      return undefined;
    }
  }
}

function isTokenFault(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return false;
  return error.code.startsWith('ERR_JWT_') || error.code.startsWith('ERR_JWS_') || TOKEN_FAULT_CODES.has(error.code);
}

// The Connect rules beyond the checks of jose. jose checks no issue time without a maximum token age.
function connectClaimsOf(payload: JWTPayload): ConnectClaims {
  const claims = typedClaimsOf(payload);
  if (claims.subject === claims.clientId) throw new InvalidAccessTokenError('The access token has the subject of an M2M token');
  if (claims.issuedAt > nowInSeconds() + CLOCK_TOLERANCE_SECONDS) throw new InvalidAccessTokenError('The access token has an issue time in the future');
  return claims;
}

function typedClaimsOf(payload: JWTPayload): ConnectClaims {
  const { iss, sub, sid, client_id: clientId, scope, iat, exp } = payload;
  if (!isText(iss) || !isText(sub) || !isText(sid) || !isText(clientId) || typeof scope !== 'string' || !isTime(iat) || !isTime(exp)) {
    throw new InvalidAccessTokenError('The access token does not have the claims of a Connect user token');
  }
  const scopes = scope.split(' ').filter((part) => part !== '');
  return { issuer: iss, subject: sub, clientId, organizationId: organizationIdOf(payload.org_id), scopes, issuedAt: iat, expiresAt: exp };
}

// A user without an organization has no org_id. A present org_id must name an organization.
function organizationIdOf(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isText(value)) throw new InvalidAccessTokenError('The access token has an organization claim that is not valid');
  return value;
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function profileNameOf(profile: unknown, subject: string): string | undefined {
  if (typeof profile !== 'object' || profile === null || !('id' in profile) || profile.id !== subject) return undefined;
  const user = profile as { name?: unknown; firstName?: unknown; lastName?: unknown };
  // A nonempty native name takes precedence; invalid display data is omitted by the request context.
  if (typeof user.name === 'string' && (user.name.trim() !== '' || /\p{Cc}/u.test(user.name))) return user.name;
  if (user.name != null && typeof user.name !== 'string') return undefined;
  const parts = [user.firstName, user.lastName];
  if (parts.some(part => part != null && (typeof part !== 'string' || /\p{Cc}/u.test(part)))) return undefined;
  return parts.filter((part): part is string => typeof part === 'string').map(part => part.trim()).filter(Boolean).join(' ') || undefined;
}
