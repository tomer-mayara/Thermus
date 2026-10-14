import type { TestContext } from 'node:test';
import { createRemoteJWKSet } from 'jose';
import type { WorkOSConnection } from '../../src/hosted-workos-application.ts';
import type { WorkOSSettings } from '../../src/auth/hosted-auth/workos/workos-settings.ts';
import { nowInSeconds, SigningKey } from './jwt-signing-key.ts';
import { cookiePassword, fakeApiKey, fakeClientId, WorkOSFakeApi, workosClientFor, type FakeAnswer, type RecordedRequest } from './workos-fake-api.ts';

export interface WorldUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
}

export interface WorldMembership {
  readonly userId: string;
  readonly organizationId: string;
  readonly roles: readonly string[];
  readonly status?: 'active' | 'inactive';
}

interface WorldSession {
  readonly user: WorldUser;
  organizationId: string | undefined;
  ended: boolean;
}

// The roles of the hosted role mapping, as the staging environment defines them.
const environmentRoles: Readonly<Record<string, readonly string[]>> = {
  user: ['product:access'],
  admin: ['user-grants:manage'],
  'super-admin': ['admin-grants:manage', 'billing:manage'],
  member: [],
};
const membershipsRoute = 'GET /user_management/organization_memberships';
const authenticateRoute = 'POST /user_management/authenticate';
export const mcpClientId = 'client_01MCPCLIENT';

function userJson(user: WorldUser) {
  return {
    object: 'user', id: user.id, email: user.email, email_verified: true, first_name: user.firstName, last_name: 'Example',
    profile_picture_url: null, last_sign_in_at: null, locale: null, external_id: null, metadata: {},
    created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-13T08:00:00.000Z',
  };
}

function roleJson(slug: string) {
  return {
    object: 'role', id: `role_01${slug.toUpperCase().replace('-', '')}`, name: slug, slug, description: null,
    permissions: environmentRoles[slug] ?? [], type: 'EnvironmentRole', resource_type_slug: 'organization',
    created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z',
  };
}

function membershipJson(membership: WorldMembership, index: number) {
  return {
    object: 'organization_membership', id: `om_${index}`, user_id: membership.userId, organization_id: membership.organizationId,
    organization_name: membership.organizationId, status: membership.status ?? 'active', directory_managed: false,
    role: { slug: membership.roles[0] ?? 'member' }, roles: (membership.roles.length === 0 ? ['member'] : membership.roles).map((slug) => ({ slug })),
    custom_attributes: {}, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-13T08:00:00.000Z',
  };
}

// A local WorkOS environment for the offline tests of the hosted WorkOS composition: a fake WorkOS API with users,
// memberships, the hosted roles, browser sign-ins and refreshes, and AuthKit-signed Connect tokens.
export class WorkOSWorld {
  readonly fake: WorkOSFakeApi;
  readonly browserKey: SigningKey;
  readonly authkitKey: SigningKey;
  readonly settings: WorkOSSettings;
  readonly mcpResourceUrl: string;
  memberships: readonly WorldMembership[] = [];
  // Set to an answer, such as a 500, to make the membership reads or the refreshes fail.
  membershipOutage: FakeAnswer | undefined;
  refreshOutage: FakeAnswer | undefined;
  readonly #sessions = new Map<string, WorldSession>();
  readonly #codes = new Map<string, WorldSession>();
  #accessTokenLifetime = 300;
  #counter = 0;

  private constructor(parts: { fake: WorkOSFakeApi; browserKey: SigningKey; authkitKey: SigningKey; publicBaseUrl: string }) {
    this.fake = parts.fake;
    this.browserKey = parts.browserKey;
    this.authkitKey = parts.authkitKey;
    this.mcpResourceUrl = new URL('mcp', parts.publicBaseUrl).href;
    this.settings = Object.freeze({
      apiKey: fakeApiKey,
      clientId: fakeClientId,
      authkitIssuer: parts.fake.authkitIssuer,
      redirectUri: new URL('callback', parts.publicBaseUrl).href,
      cookiePassword,
    });
    this.fake.answer(membershipsRoute, (request) => this.membershipsAnswer(request));
    this.fake.answer(authenticateRoute, (request) => this.authenticateAnswer(request));
  }

  static async start(t: TestContext, publicBaseUrl: string, organizations: readonly string[]): Promise<WorkOSWorld> {
    const fake = await WorkOSFakeApi.start(t);
    const [browserKey, authkitKey] = await Promise.all([SigningKey.generate('browser-key-1'), SigningKey.generate('authkit-key-1')]);
    fake.browserKeySet.publish(browserKey);
    fake.authkitKeySet.publish(authkitKey);
    const world = new WorkOSWorld({ fake, browserKey, authkitKey, publicBaseUrl });
    for (const organization of organizations) {
      fake.answer(`GET /authorization/organizations/${organization}/roles`, { status: 200, body: { object: 'list', data: Object.keys(environmentRoles).map(roleJson) } });
    }
    return world;
  }

  connection(): WorkOSConnection {
    return { settings: this.settings, workos: workosClientFor(this.fake), authkitKeySet: createRemoteJWKSet(this.fake.authkitKeySetUrl) };
  }

  // Makes an authorization code as AuthKit gives it after the sign-in, the MFA step, and the organization choice.
  codeFor(user: WorldUser, organizationId?: string): string {
    const code = `code_${(this.#counter += 1)}`;
    this.#codes.set(code, { user, organizationId, ended: false });
    return code;
  }

  // Lets each next access token expire at once, so the next request needs a refresh.
  expireAccessTokens(): void {
    this.#accessTokenLifetime = -60;
  }

  endSessionsOf(user: WorldUser): void {
    for (const session of this.#sessions.values()) if (session.user.id === user.id) session.ended = true;
  }

  connectToken(user: WorldUser, claims: Readonly<Record<string, unknown>> = {}): Promise<string> {
    return this.authkitKey.sign({ sub: user.id, client_id: mcpClientId, sid: `app_consent_${user.id}`, scope: 'email offline_access openid profile', jti: `jti_${(this.#counter += 1)}`, ...claims }, {
      issuer: this.fake.authkitIssuer,
      audience: this.mcpResourceUrl,
      expiresAtUnixSeconds: nowInSeconds() + 300,
    });
  }

  browserToken(user: WorldUser, organizationId?: string): Promise<string> {
    return this.browserKey.sign({ sub: user.id, sid: `session_${user.id}`, client_id: fakeClientId, ...(organizationId === undefined ? {} : { org_id: organizationId }) }, {
      issuer: this.fake.browserIssuer,
      expiresAtUnixSeconds: nowInSeconds() + this.#accessTokenLifetime,
    });
  }

  private membershipsAnswer(request: RecordedRequest): FakeAnswer {
    if (this.membershipOutage) return this.membershipOutage;
    const query = new URL(request.path, 'http://fake').searchParams;
    const statuses = (query.get('statuses') ?? 'active').split(',');
    const data = this.memberships
      .map((membership, index) => ({ membership, index }))
      .filter(({ membership }) => membership.userId === query.get('user_id') && membership.organizationId === query.get('organization_id'))
      .filter(({ membership }) => statuses.includes(membership.status ?? 'active'))
      .map(({ membership, index }) => membershipJson(membership, index));
    return { status: 200, body: { object: 'list', data, list_metadata: { before: null, after: null } } };
  }

  private async authenticateAnswer(request: RecordedRequest): Promise<FakeAnswer> {
    const body = request.body as Readonly<Record<string, string | undefined>>;
    return body.grant_type === 'authorization_code' ? this.codeAnswer(body.code ?? '') : this.refreshAnswer(body);
  }

  private async codeAnswer(code: string): Promise<FakeAnswer> {
    const session = this.#codes.get(code);
    if (session === undefined) return { status: 400, body: { error: 'invalid_grant', error_description: 'The code is not valid.' } };
    this.#codes.delete(code);
    return this.sessionAnswer(session);
  }

  private async refreshAnswer(body: Readonly<Record<string, string | undefined>>): Promise<FakeAnswer> {
    if (this.refreshOutage) return this.refreshOutage;
    const session = this.#sessions.get(body.refresh_token ?? '');
    if (session === undefined || session.ended) return { status: 400, body: { error: 'invalid_grant', error_description: 'The session has ended.' } };
    const organizationId = body.organization_id ?? session.organizationId;
    if (organizationId !== undefined && !this.hasActiveMembership(session.user, organizationId)) {
      return { status: 400, body: { error: 'organization_membership_not_found', error_description: 'No membership.' } };
    }
    session.organizationId = organizationId;
    return this.sessionAnswer(session);
  }

  private hasActiveMembership(user: WorldUser, organizationId: string): boolean {
    return this.memberships.some((m) => m.userId === user.id && m.organizationId === organizationId && (m.status ?? 'active') === 'active');
  }

  private async sessionAnswer(session: WorldSession): Promise<FakeAnswer> {
    const refreshToken = `refresh_${(this.#counter += 1)}`;
    this.#sessions.set(refreshToken, session);
    const accessToken = await this.browserToken(session.user, session.organizationId);
    return {
      status: 200,
      body: {
        user: userJson(session.user),
        ...(session.organizationId === undefined ? {} : { organization_id: session.organizationId }),
        access_token: accessToken,
        refresh_token: refreshToken,
        authentication_method: 'Password',
      },
    };
  }
}
