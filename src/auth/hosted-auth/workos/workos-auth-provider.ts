import { errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import {
  createRequestContext,
  type AccessDecision,
  type AccessResolver,
  type AuthenticatedUser,
  type RoleGrant,
} from '../../access-context.ts';
import { InvalidAccessTokenError, type IdentityVerifier, type VerifiedIdentity } from '../../identity-verifier.ts';

// The fresh read of the current grants of one user in one organization. No active membership gives undefined.
interface ActiveGrantReader {
  activeGrants(userId: string, organizationId: string): Promise<readonly RoleGrant[] | undefined>;
}

export interface WorkOSAuthProviderOptions {
  // The one authority of the WorkOS environment, from workosAuthority(). The client ID of an MCP client never changes it.
  readonly authority: string;
  // Exactly as written: each Connect access token must carry this issuer.
  readonly authkitIssuer: string;
  // Each Connect access token must have this MCP resource as its audience.
  readonly mcpResourceUrl: string;
  // The AuthKit key set. In production: createRemoteJWKSet(<authkitIssuer>/oauth2/jwks).
  readonly keySet: JWTVerifyGetKey;
  readonly grants: ActiveGrantReader;
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

export class WorkOSAuthProvider implements IdentityVerifier, AccessResolver {
  private readonly options: WorkOSAuthProviderOptions;

  constructor(options: WorkOSAuthProviderOptions) {
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

  // Each call reads the current grants, so a revoked membership or role stops access before the token expires. It does
  // not require product:access: the administration pages also resolve the access of an Admin without it.
  async resolve(user: AuthenticatedUser): Promise<AccessDecision> {
    const { authority, grants } = this.options;
    if (user.authority !== authority) return ACCOUNT_INACTIVE;
    const organizationId = user.selectedOrganizationId;
    if (organizationId === undefined || organizationId === '') return ORGANIZATION_REQUIRED;
    const activeGrants = await grants.activeGrants(user.subject, organizationId);
    if (activeGrants === undefined) return MEMBERSHIP_INACTIVE;
    return {
      allowed: true,
      context: createRequestContext({ user, tenantId: hostedTenantId(authority, organizationId), organizationId, grants: activeGrants }),
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
