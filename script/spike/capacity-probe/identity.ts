import assert from 'node:assert/strict';
import { discoverAuthorizationServerMetadata, refreshAuthorization } from '@modelcontextprotocol/client';
import { addRow, seconds } from '../render-tenant-lifecycle/context.ts';
import { visitAuthKit } from '../../../test/support/hosted-live/authkit-driver.ts';
import { connectAuthorizationRequest, exchangeConnectCode, issuedTokens, type IssuedTokens } from '../../../test/support/hosted-live/connect-client.ts';
import { FixtureRegistry } from '../../../test/support/hosted-live/fixture-registry.ts';
import { LiveBrowser } from '../../../test/support/hosted-live/live-browser.ts';
import { connectRedirectUri, requestTimeout, workosClient, type HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';
import { FixtureFactory, type LiveOrganization, type LiveUser } from '../../../test/support/hosted-live/staging-fixtures.ts';
import { readToken } from '../../../test/support/hosted-live/tokens.ts';
import type { ProbeContext, TokenProvider } from './context.ts';

const STEP = 'Identity';
// A Connect access token lasted 300 s in earlier runs; the probe refreshes it when less than 2 minutes are left.
const REFRESH_MARGIN_SECONDS = 120;

interface RefreshPlan {
  readonly issuer: string;
  readonly clientId: string;
  readonly resource: string;
}

function expiryOf(token: string): number {
  return Number(readToken(token).claims.exp ?? 0);
}

// One refresh at a time: the refresh token rotates, so a second refresh with the old token would fail.
class ConnectTokens implements TokenProvider {
  #access: string;
  #refresh: string | undefined;
  #expiresAt: number;
  #renewing: Promise<void> | undefined;
  readonly #plan: RefreshPlan;
  readonly lifetimeSeconds: number;
  refreshes = 0;

  public constructor(tokens: IssuedTokens, plan: RefreshPlan) {
    this.#access = tokens.accessToken;
    this.#refresh = tokens.refreshToken;
    this.#expiresAt = expiryOf(tokens.accessToken);
    this.#plan = plan;
    this.lifetimeSeconds = readToken(tokens.accessToken).lifetime ?? 0;
  }

  public async token(): Promise<string> {
    if (this.#expiresAt - Date.now() / 1_000 > REFRESH_MARGIN_SECONDS) return this.#access;
    this.#renewing ??= this.#renew().finally(() => {
      this.#renewing = undefined;
    });
    await this.#renewing;
    return this.#access;
  }

  async #renew(): Promise<void> {
    const refreshToken = this.#refresh;
    if (refreshToken === undefined) throw new Error('The Connect grant gave no refresh token, so the access token cannot be renewed.');
    const { issuer, clientId, resource } = this.#plan;
    const metadata = await discoverAuthorizationServerMetadata(issuer);
    const tokens = await refreshAuthorization(issuer, { metadata, clientInformation: { client_id: clientId }, refreshToken, resource: new URL(resource) });
    this.#access = tokens.access_token;
    this.#refresh = tokens.refresh_token ?? refreshToken;
    this.#expiresAt = expiryOf(tokens.access_token);
    this.refreshes += 1;
  }
}

async function discoveryPreflight(issuer: string): Promise<void> {
  const response = await fetch(`${issuer}/.well-known/oauth-authorization-server`, { signal: AbortSignal.timeout(requestTimeout) });
  await response.body?.cancel();
  assert.equal(response.status, 200, `The AuthKit discovery of ${issuer} answered ${response.status}`);
}

async function timed<T>(context: ProbeContext, call: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    const value = await work();
    context.report.workosWrites.push({ step: STEP, call, status: 'done', ms: performance.now() - started });
    return value;
  } catch (error) {
    context.report.workosWrites.push({ step: STEP, call, status: 'failed', ms: performance.now() - started });
    throw error;
  }
}

interface Grantee {
  readonly user: LiveUser;
  readonly organization: LiveOrganization;
  readonly clientId: string;
}

// The Connect authorization of the hosted live gate (connect-client.ts and authkit-driver.ts), with the resource of
// the tenant service in place of the resource of the live gate: AuthKit binds the token to the requested resource.
async function authorize(context: ProbeContext, grantee: Grantee, resource: string): Promise<{ readonly tokens: IssuedTokens; readonly pages: readonly string[] }> {
  const { authkitIssuer } = context.secrets.workos;
  const request = connectAuthorizationRequest(authkitIssuer, grantee.clientId);
  const url = new URL(request.url);
  url.searchParams.set('resource', resource);
  const browser = context.state.fixtures?.browser;
  assert.ok(browser !== undefined, 'No browser: the fixtures were not made.');
  const page = await browser.newPage();
  try {
    const visit = await visitAuthKit(page, url.href, { user: grantee.user, organizationName: grantee.organization.name, authkitHost: new URL(authkitIssuer).host, callback: connectRedirectUri });
    const code = visit.callback.searchParams.get('code');
    assert.ok(code, `The Connect callback has no code. It has: ${[...visit.callback.searchParams.keys()].join(', ')}.`);
    assert.equal(visit.callback.searchParams.get('state'), request.state, 'The Connect callback has another state.');
    const answer = await exchangeConnectCode(authkitIssuer, grantee.clientId, { code, verifier: request.verifier, resource });
    return { tokens: issuedTokens(answer, 'The Connect code exchange'), pages: visit.pages };
  } finally {
    await page.context().close();
  }
}

function checkClaims(context: ProbeContext, tokens: IssuedTokens, expected: { readonly resource: string; readonly grantee: Grantee }): number {
  const view = readToken(tokens.accessToken);
  const audience = [view.claims.aud ?? []].flat();
  const measured = `audience ${audience.includes(expected.resource) ? 'is the tenant resource' : 'is another resource'}; organization ${view.claims.org_id === expected.grantee.organization.id ? 'matches' : 'differs'}; user ${view.claims.sub === expected.grantee.user.id ? 'matches' : 'differs'}; lifetime ${view.lifetime ?? 'unknown'} s; refresh token ${tokens.refreshToken === undefined ? 'absent' : 'present'}`;
  addRow(context, STEP, { check: 'Connect access token (claims only, never the token)', expected: 'audience, organization, and user of the run; lifetime recorded', measured });
  assert.ok(audience.includes(expected.resource), 'The token audience is not the tenant resource.');
  assert.equal(view.claims.org_id, expected.grantee.organization.id, 'The token names another organization.');
  assert.equal(view.claims.sub, expected.grantee.user.id, 'The token names another user.');
  return view.lifetime ?? 0;
}

// A disposable organization, a user with one membership, and a Connect application of the run, then a token.
export async function createIdentity(context: ProbeContext, resource: string): Promise<string> {
  const settings: HostedLiveSettings = context.secrets.workos;
  const workos = workosClient(settings);
  const registry = new FixtureRegistry(workos);
  const runId = `so01e-${context.run.toLowerCase()}`;
  context.state.fixtures = { workos, registry, browser: new LiveBrowser(() => discoveryPreflight(settings.authkitIssuer)), runId };
  const make = new FixtureFactory(workos, registry, runId);
  const organization = await timed(context, 'createOrganization', () => make.organization('capacity'));
  const user = await timed(context, 'createUser', () => make.user('capacity'));
  await timed(context, 'createOrganizationMembership (role user)', () => make.membership(user, organization, ['user']));
  const application = await timed(context, 'connect.createApplication (OAuth, PKCE)', () => make.oauthApplication(organization));
  addRow(context, STEP, { check: 'Fixtures of the run', expected: 'organization, user with a membership, Connect application', measured: `${organization.id}, ${user.id}, ${application.id}; names and email have the run ID ${runId}` });
  const grantee = { user, organization, clientId: application.clientId };
  const started = performance.now();
  const { tokens, pages } = await authorize(context, grantee, resource);
  addRow(context, STEP, { check: 'Connect authorization in a headless browser', expected: 'the callback has the code and the state', measured: `${seconds(performance.now() - started)}; AuthKit pages ${pages.join(' > ')}` });
  const lifetime = checkClaims(context, tokens, { resource, grantee });
  context.state.tokens = new ConnectTokens(tokens, { issuer: settings.authkitIssuer, clientId: application.clientId, resource });
  return `the fixtures of ${runId} exist, and the Connect token for ${resource} lasts ${lifetime} s.`;
}
