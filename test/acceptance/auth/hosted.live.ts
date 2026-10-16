import assert from 'node:assert/strict';
import { after, before, describe, test, type TestContext } from 'node:test';
import { createLocalJWKSet, type JSONWebKeySet } from 'jose';
import { hostedMfaPolicy } from '../../support/hosted-live/mfa-profile.ts';
import { LiveRun } from '../../support/hosted-live/live-run.ts';
import { authkitKeySetUrl, requestTimeout, workosClient, type HostedLiveSettings } from '../../support/hosted-live/settings.ts';
import { describeAdministrationProofs } from './hosted-live/administration-proofs.ts';
import { describeAdministrationServerCases } from './hosted-live/administration-server.ts';
import { describeBrowserSignInProofs } from './hosted-live/browser-sign-in.ts';
import { assertMfaProfileBeforeLiveProofs, describeConfigurationProofs } from './hosted-live/configuration.ts';
import { describeConnectAuthorizationProofs } from './hosted-live/connect-authorization.ts';
import { describeConnectTokenProofs } from './hosted-live/connect-tokens.ts';
import { describeHostedServerCases } from './hosted-live/hosted-server.ts';
import { describeMembershipProofs } from './hosted-live/memberships.ts';
import { describeOperatorSetupProofs } from './hosted-live/operator-setup.ts';
import { describeOptionalAdministrationServerCases } from './hosted-live/optional-administration-server.ts';
import { describeOrganizationServerCases } from './hosted-live/organization-server.ts';
import { describeSignupServerCases } from './hosted-live/signup-server.ts';
import { describeSessionEndingProofs } from './hosted-live/session-ending.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type JsonObject = Readonly<Record<string, unknown>>;
// A refusal gives the reason why the gate does not accept a value. The reason must not contain the value.
type Refusal = (value: string) => string | undefined;

type HostedLiveSetup = { readonly settings: HostedLiveSettings } | { readonly problems: readonly string[] };

const stagingKeyPrefix = 'sk_test_';
const issuerRefusedCharacters = /[\s\p{Cc}?#]/u;
const proofOptions = { timeout: 30_000 };
const recordedMetadataFields = [
  'scopes_supported',
  'grant_types_supported',
  'token_endpoint_auth_methods_supported',
  'client_id_metadata_document_supported',
];

function stagingKeyRefusal(value: string): string | undefined {
  if (value.startsWith(stagingKeyPrefix)) return undefined;
  return `it is not a WorkOS staging key. The live proofs make and change WorkOS data, so the gate accepts only a staging key that starts with ${stagingKeyPrefix}.`;
}

function issuerRefusal(value: string): string | undefined {
  const url = URL.parse(value);
  const httpsWithoutUser = url?.protocol === 'https:' && url.username === '' && url.password === '';
  if (httpsWithoutUser && !issuerRefusedCharacters.test(value)) return undefined;
  return 'it must be an absolute https URL without spaces, a username, a password, a query, or a fragment.';
}

function settingProblem(name: string, value: string, refusal: Refusal): string | undefined {
  if (value === '') return `${name} is missing or empty.`;
  const reason = refusal(value);
  return reason === undefined ? undefined : `${name} is refused: ${reason}`;
}

// A new live proof that needs another setting reads it here, so that the same setup gate checks it.
function hostedLiveSetup(environment: Environment): HostedLiveSetup {
  const problems: string[] = [];
  const read = (name: string, refusal: Refusal = () => undefined): string => {
    const value = environment[name] ?? '';
    const problem = settingProblem(name, value, refusal);
    if (problem !== undefined) problems.push(problem);
    return value;
  };
  const settings: HostedLiveSettings = {
    apiKey: read('WORKOS_API_KEY', stagingKeyRefusal),
    clientId: read('WORKOS_CLIENT_ID'),
    authkitIssuer: read('WORKOS_AUTHKIT_ISSUER', issuerRefusal),
    mfaPolicy: 'optional',
  };
  try {
    const mfaPolicy = hostedMfaPolicy(environment.WORKOS_MFA_POLICY);
    return problems.length === 0 ? { settings: { ...settings, mfaPolicy } } : { problems };
  } catch (error) {
    problems.push(error instanceof Error ? error.message : 'WORKOS_MFA_POLICY is refused.');
    return { problems };
  }
}

function setupError(problems: readonly string[]): Error {
  return new Error([
    'Hosted live setup error. The hosted live gate did not start its live proofs:',
    ...problems.map((problem) => `- ${problem}`),
    'Set these settings for a WorkOS staging environment. Then run npm run test:hosted-live again.',
    'A setup error is not a pass of the hosted live gate.',
    'The section "Hosted live gate (AUTH-06)" of docs/implementation/test-gate-policy.md gives the settings and the gate rules.',
  ].join('\n'));
}

function registerSetupFailure(problems: readonly string[]): void {
  // Without its settings, the gate registers only this test. Thus the run cannot pass, has no skipped test, and uses no network.
  test('Given the hosted live gate, when it starts, then the WorkOS staging settings are present', () => {
    throw setupError(problems);
  });
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(requestTimeout) });
  assert.equal(response.status, 200, `GET ${url} gave HTTP ${response.status}.`);
  assert.match(response.headers.get('Content-Type') ?? '', /json/i, `GET ${url} gave no JSON.`);
  return response.json();
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function includes(list: unknown, item: string): boolean {
  return Array.isArray(list) && list.includes(item);
}

function observed(value: unknown): string {
  return value === undefined ? 'absent' : JSON.stringify(value);
}

function recordMetadata(t: TestContext, metadata: JsonObject): void {
  for (const field of recordedMetadataFields) t.diagnostic(`${field}: ${observed(metadata[field])}`);
  t.diagnostic(`registration_endpoint: ${metadata.registration_endpoint === undefined ? 'absent' : 'present'}`);
}

async function assertSigningKeySet(t: TestContext, url: string): Promise<void> {
  const body = await readJson(url);
  // jose checks the shape of the set. It refuses a malformed set, as the token verifier does.
  const { keys } = createLocalJWKSet(body as JSONWebKeySet).jwks();
  for (const { kty, alg, use } of keys) t.diagnostic(`key: kty ${observed(kty)}, alg ${observed(alg)}, use ${observed(use)}`);
  const signingKeys = keys.filter(({ use }) => use === undefined || use === 'sig');

  assert.ok(signingKeys.length > 0, `${url} has no signing key.`);
  for (const { kid } of signingKeys) assert.ok(typeof kid === 'string' && kid !== '', `${url} has a signing key without a key ID.`);
}

function describeAuthKitAuthorizationServer(settings: HostedLiveSettings): void {
  const { authkitIssuer } = settings;

  describe('Hosted live proofs: the AuthKit authorization server of Connect', () => {
    test('Given the AuthKit issuer, when its authorization-server metadata is read, then it names the exact issuer, the AuthKit key set, the authorization code grant, S256 PKCE, the client registration endpoint, and client ID metadata documents', proofOptions, async (t) => {
      const metadata = await readJson(`${authkitIssuer}/.well-known/oauth-authorization-server`);
      assert.ok(isJsonObject(metadata), 'The authorization-server metadata is not a JSON object.');
      recordMetadata(t, metadata);

      assert.equal(metadata.issuer, authkitIssuer);
      assert.equal(metadata.jwks_uri, authkitKeySetUrl(authkitIssuer));
      assert.ok(includes(metadata.grant_types_supported, 'authorization_code'), 'grant_types_supported does not include authorization_code.');
      assert.ok(includes(metadata.code_challenge_methods_supported, 'S256'), 'code_challenge_methods_supported does not include S256.');
      assert.equal(metadata.registration_endpoint, `${authkitIssuer}/oauth2/register`, 'registration_endpoint is not <issuer>/oauth2/register. MCP clients such as Claude Code register themselves at AuthKit, so Dynamic Client Registration must be on in the staging environment.');
      assert.equal(metadata.client_id_metadata_document_supported, true, 'client_id_metadata_document_supported is not true. MCP clients such as Claude Code register themselves at AuthKit, so Client ID Metadata Documents must be on in the staging environment.');
    });

    test('Given the AuthKit key set, when it is read, then it has signing keys with key IDs, and jose accepts the set', proofOptions, async (t) => {
      await assertSigningKeySet(t, authkitKeySetUrl(authkitIssuer));
    });
  });
}

function describeWorkOSApi(settings: HostedLiveSettings): void {
  describe('Hosted live proofs: the WorkOS API of browser sessions and administration', () => {
    test('Given the WorkOS client ID, when the browser-session key set is read, then it has signing keys with key IDs, and jose accepts the set', proofOptions, async (t) => {
      await assertSigningKeySet(t, workosClient(settings).userManagement.getJwksUrl(settings.clientId));
    });

    test('Given the staging API key, when it lists organizations, then WorkOS accepts the key', proofOptions, async () => {
      const organizations = await workosClient(settings).organizations.listOrganizations({ limit: 1 });

      assert.ok(Array.isArray(organizations.data));
    });
  });
}

const setup = hostedLiveSetup(process.env);
if ('problems' in setup) {
  registerSetupFailure(setup.problems);
} else {
  describeAuthKitAuthorizationServer(setup.settings);
  describeWorkOSApi(setup.settings);
  const run = new LiveRun(setup.settings);
  after(() => run.end());
  before(async (t) => {
    t.diagnostic(`Hosted live MFA profile: ${setup.settings.mfaPolicy}.`);
    await assertMfaProfileBeforeLiveProofs(run);
  });
  describeConfigurationProofs(run);
  describeBrowserSignInProofs(run);
  describeSessionEndingProofs(run);
  describeConnectAuthorizationProofs(run);
  describeConnectTokenProofs(run);
  describeMembershipProofs(run);
  describeOperatorSetupProofs(run);
  describeAdministrationProofs(run);
  // The AUTH-07W cases come before the AUTH-06 cases, so that the 300-second wait of the AUTH-06 cases also lets the
  // access token of the AUTH-07W selection session expire before its expiry case. The AUTH-08W cases come between them.
  const describeExpiredSelectionCase = describeOrganizationServerCases(run);
  if (setup.settings.mfaPolicy === 'required') describeAdministrationServerCases(run);
  else describeOptionalAdministrationServerCases(run);
  describeHostedServerCases(run);
  describeExpiredSelectionCase();
  describeSignupServerCases(run);
}
