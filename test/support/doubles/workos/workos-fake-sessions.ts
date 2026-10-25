import { nowInSeconds, type SigningKey } from './jwt-signing-key.ts';
import { fakeClientId, type FakeAnswer, type RecordedRequest, type WorkOSFakeApi } from './workos-fake-api.ts';
import type { FakeMembership, FakeUser } from './workos-fake.ts';
import { invalidGrant, organizationMembershipNotFound, userJson } from './workos-fake-wire.ts';
import { membershipIdAt } from './workos-fake-directory.ts';

// What the codes, the refreshes, and the tokens read of the fake.
export interface SessionView {
  readonly fake: WorkOSFakeApi;
  readonly browserKey: SigningKey;
  readonly authkitKey: SigningKey;
  readonly mcpResourceUrl: string;
  readonly memberships: readonly FakeMembership[];
  readonly deletedMembershipIds: ReadonlySet<string>;
  readonly authenticationMethod: string;
  readonly refreshOutage: FakeAnswer | undefined;
  nextNumber(): number;
  browserToken(user: FakeUser, organizationId?: string): Promise<string>;
}

interface FakeSession {
  readonly user: FakeUser;
  organizationId: string | undefined;
  ended: boolean;
}

const authenticateRoute = 'POST /user_management/authenticate';
const mcpClientId = 'client_01MCPCLIENT';

export class WorkOSFakeSessions {
  readonly #view: SessionView;
  readonly #sessions = new Map<string, FakeSession>();
  readonly #codes = new Map<string, FakeSession>();
  #accessTokenLifetime = 300;

  constructor(view: SessionView) {
    this.#view = view;
    view.fake.answer(authenticateRoute, (request) => this.authenticateAnswer(request));
  }

  codeFor(user: FakeUser, organizationId?: string): string {
    const code = `code_${this.#view.nextNumber()}`;
    this.#codes.set(code, { user, organizationId, ended: false });
    return code;
  }

  expireAccessTokens(): void {
    this.#accessTokenLifetime = -60;
  }

  endSessionsOf(user: FakeUser): void {
    for (const session of this.#sessions.values()) if (session.user.id === user.id) session.ended = true;
  }

  connectToken(user: FakeUser, claims: Readonly<Record<string, unknown>>): Promise<string> {
    const { authkitKey, fake, mcpResourceUrl } = this.#view;
    return authkitKey.sign({ sub: user.id, client_id: mcpClientId, sid: `app_consent_${user.id}`, scope: 'email offline_access openid profile', jti: `jti_${this.#view.nextNumber()}`, ...claims }, {
      issuer: fake.authkitIssuer,
      audience: mcpResourceUrl,
      expiresAtUnixSeconds: nowInSeconds() + 300,
    });
  }

  browserToken(user: FakeUser, organizationId?: string): Promise<string> {
    const { browserKey, fake } = this.#view;
    return browserKey.sign({ sub: user.id, sid: `session_${user.id}`, client_id: fakeClientId, ...(organizationId === undefined ? {} : { org_id: organizationId }) }, {
      issuer: fake.browserIssuer,
      expiresAtUnixSeconds: nowInSeconds() + this.#accessTokenLifetime,
    });
  }

  private async authenticateAnswer(request: RecordedRequest): Promise<FakeAnswer> {
    const body = request.body as Readonly<Record<string, string | undefined>>;
    return body.grant_type === 'authorization_code' ? this.codeAnswer(body.code ?? '') : this.refreshAnswer(body);
  }

  private async codeAnswer(code: string): Promise<FakeAnswer> {
    const session = this.#codes.get(code);
    if (session === undefined) return invalidGrant('The code is not valid.');
    this.#codes.delete(code);
    return this.sessionAnswer(session);
  }

  private async refreshAnswer(body: Readonly<Record<string, string | undefined>>): Promise<FakeAnswer> {
    if (this.#view.refreshOutage) return this.#view.refreshOutage;
    const session = this.#sessions.get(body.refresh_token ?? '');
    if (session === undefined || session.ended) return invalidGrant('The session has ended.');
    const organizationId = body.organization_id ?? session.organizationId;
    if (organizationId !== undefined && !this.hasActiveMembership(session.user, organizationId)) return organizationMembershipNotFound;
    session.organizationId = organizationId;
    return this.sessionAnswer(session);
  }

  private hasActiveMembership(user: FakeUser, organizationId: string): boolean {
    return this.#view.memberships.some((m, index) => m.userId === user.id && m.organizationId === organizationId && (m.status ?? 'active') === 'active' && !this.#view.deletedMembershipIds.has(membershipIdAt(index)));
  }

  private async sessionAnswer(session: FakeSession): Promise<FakeAnswer> {
    const refreshToken = `refresh_${this.#view.nextNumber()}`;
    this.#sessions.set(refreshToken, session);
    // Through the view: a test that replaces browserToken() of the fake also replaces the access tokens of the sessions.
    const accessToken = await this.#view.browserToken(session.user, session.organizationId);
    return {
      status: 200,
      body: {
        user: userJson(session.user),
        ...(session.organizationId === undefined ? {} : { organization_id: session.organizationId }),
        access_token: accessToken,
        refresh_token: refreshToken,
        authentication_method: this.#view.authenticationMethod,
      },
    };
  }
}
