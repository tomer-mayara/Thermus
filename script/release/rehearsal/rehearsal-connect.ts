// The Connect tokens of the rehearsal: an MCP client authorization of a test user through AuthKit in a headless browser,
// with PKCE and the resource of the staging control plane, as the hosted live gate and the SO-01e probe do it, but with
// the own loopback callback of the rehearsal. The tokens stay in the private state file; a report gives the claims only.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { visitAuthKit } from '../../../test/support/hosted-live/authkit-driver.ts';
import { LiveBrowser } from '../../../test/support/hosted-live/live-browser.ts';
import { connectScope, requestTimeout, type HostedLiveSettings } from '../../../test/support/hosted-live/settings.ts';
import { readToken } from '../../../test/support/hosted-live/tokens.ts';
import { CONNECT_CALLBACK } from './rehearsal-settings.ts';
import { readState, savedOrganization, savedUser, updateState, type SavedTokens } from './rehearsal-state.ts';

type Print = (line: string) => void;

/** The WorkOS Staging values, the private state folder, and the output of one command. */
export interface TokenSession {
  readonly settings: HostedLiveSettings;
  readonly dir: string;
  readonly print: Print;
}

// A Connect access token lasted 300 s (SO-01e); a call renews it when less than this is left.
const RENEW_MARGIN_SECONDS = 60;

interface TokenBody {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly error?: string;
}

async function tokenRequest(issuer: string, fields: Readonly<Record<string, string>>): Promise<{ readonly status: number; readonly body: TokenBody }> {
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(requestTimeout),
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as TokenBody };
}

function savedTokens(body: TokenBody, refreshBefore?: string): SavedTokens {
  assert.ok(body.access_token, 'The token answer has no access token.');
  const expiresAt = Number(readToken(body.access_token).claims.exp ?? 0);
  return { access: body.access_token, refresh: body.refresh_token ?? refreshBefore, expiresAt };
}

/** The claims of a token for a report: the audience, the organization, the user, and the lifetime. Never the token. */
function claimsText(token: string, expected: { readonly resource: string; readonly organizationId: string; readonly userId: string }): string {
  const view = readToken(token);
  const audience = [view.claims.aud ?? []].flat();
  return [
    `audience ${audience.includes(expected.resource) ? 'is the resource of the staging control plane' : `is ${audience.join(', ')}`}`,
    `organization ${view.claims.org_id === expected.organizationId ? 'matches' : `differs (${String(view.claims.org_id)})`}`,
    `user ${view.claims.sub === expected.userId ? 'matches' : 'differs'}`,
    `lifetime ${view.lifetime ?? 'unknown'} s`,
  ].join('; ');
}

/** An authorization in a headless browser for the user and the organization of a label (A or B). */
export async function authorize({ settings, dir, print }: TokenSession, label: string): Promise<void> {
  const state = readState(dir);
  const user = savedUser(state, label);
  const organization = savedOrganization(state, label);
  const application = state.application;
  const resource = state.resource?.uri;
  assert.ok(application !== undefined && resource !== undefined, 'The state needs the Connect application (R6) and the OAuth resource (R3b).');
  const verifier = randomBytes(32).toString('base64url');
  const expectedState = randomBytes(16).toString('base64url');
  const url = new URL(`${settings.authkitIssuer}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: application.clientId, redirect_uri: CONNECT_CALLBACK, code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256', state: expectedState, resource, scope: connectScope,
  }).toString();
  const browser = new LiveBrowser(async () => {});
  try {
    const page = await browser.newPage();
    const started = performance.now();
    const visit = await visitAuthKit(page, url.href, { user, organizationName: organization.name, authkitHost: new URL(settings.authkitIssuer).host, callback: CONNECT_CALLBACK });
    const code = visit.callback.searchParams.get('code');
    assert.ok(code, 'The Connect callback has no code.');
    assert.equal(visit.callback.searchParams.get('state'), expectedState, 'The Connect callback has another state.');
    const answer = await tokenRequest(settings.authkitIssuer, { grant_type: 'authorization_code', code, redirect_uri: CONNECT_CALLBACK, client_id: application.clientId, code_verifier: verifier, resource });
    assert.equal(answer.status, 200, `The code exchange answered ${answer.status}: ${answer.body.error ?? 'no error'}`);
    const tokens = savedTokens(answer.body);
    updateState(dir, (next) => { next.tokens[label] = tokens; });
    print(`Connect authorization of user ${label} for organization ${label}: ${((performance.now() - started) / 1_000).toFixed(1)} s; AuthKit pages ${visit.pages.join(' > ')}`);
    print(`Token claims: ${claimsText(tokens.access, { resource, organizationId: organization.id, userId: user.id })}; refresh token ${tokens.refresh === undefined ? 'absent' : 'present'}`);
  } finally {
    await browser.close();
  }
}

// One renewal with the refresh token; undefined when it is refused, so a new authorization follows.
async function renewed({ settings, dir, print }: TokenSession, label: string): Promise<string | undefined> {
  const state = readState(dir);
  const refresh = state.tokens[label]?.refresh;
  const application = state.application;
  const resource = state.resource?.uri;
  if (refresh === undefined || application === undefined || resource === undefined) return undefined;
  const answer = await tokenRequest(settings.authkitIssuer, { grant_type: 'refresh_token', refresh_token: refresh, client_id: application.clientId, resource });
  if (answer.status !== 200 || answer.body.access_token === undefined) {
    print(`The refresh of the token of ${label} answered ${answer.status} (${answer.body.error ?? 'no error'}); a new authorization follows.`);
    return undefined;
  }
  const tokens = savedTokens(answer.body, refresh);
  updateState(dir, (next) => { next.tokens[label] = tokens; });
  print(`Renewed the token of ${label} with its refresh token.`);
  return tokens.access;
}

/** The access token of a label, renewed with its refresh token when it expires soon, else with a new authorization. */
export async function accessToken(session: TokenSession, label: string): Promise<string> {
  const tokens = readState(session.dir).tokens[label];
  if (tokens !== undefined && tokens.expiresAt - Date.now() / 1_000 > RENEW_MARGIN_SECONDS) return tokens.access;
  const access = await renewed(session, label);
  if (access !== undefined) return access;
  await authorize(session, label);
  const fresh = readState(session.dir).tokens[label];
  assert.ok(fresh !== undefined, `No token for ${label}.`);
  return fresh.access;
}
