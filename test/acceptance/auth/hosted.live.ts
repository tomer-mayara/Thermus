import { after, before, test } from 'node:test';
import { hostedMfaPolicy } from '../../support/hosted-live/mfa-profile.ts';
import { LiveRun } from '../../support/hosted-live/live-run.ts';
import type { HostedLiveSettings } from '../../support/hosted-live/settings.ts';
import { describeAdministrationProofs } from './hosted-live/administration-proofs.ts';
import { describeAdministrationServerCases } from './hosted-live/administration-server.ts';
import { assertMfaProfileBeforeLiveProofs } from './hosted-live/configuration.ts';
import { describeHostedServerCases } from './hosted-live/hosted-server.ts';
import { describeOperatorSetupProofs } from './hosted-live/operator-setup.ts';
import { describeOptionalAdministrationServerCases } from './hosted-live/optional-administration-server.ts';
import { describeOrganizationServerCases } from './hosted-live/organization-server.ts';
import { describeSignupServerCases } from './hosted-live/signup-server.ts';

type Environment = Readonly<Record<string, string | undefined>>;
// A refusal gives the reason why the gate does not accept a value. The reason must not contain the value.
type Refusal = (value: string) => string | undefined;

type HostedLiveSetup = { readonly settings: HostedLiveSettings } | { readonly problems: readonly string[] };

const stagingKeyPrefix = 'sk_test_';
const issuerRefusedCharacters = /[\s\p{Cc}?#]/u;

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
  const apiKey = read('WORKOS_API_KEY', stagingKeyRefusal);
  const clientId = read('WORKOS_CLIENT_ID');
  const authkitIssuer = read('WORKOS_AUTHKIT_ISSUER', issuerRefusal);
  try {
    const settings: HostedLiveSettings = { apiKey, clientId, authkitIssuer, mfaPolicy: hostedMfaPolicy(environment.WORKOS_MFA_POLICY) };
    return problems.length === 0 ? { settings } : { problems };
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

const setup = hostedLiveSetup(process.env);
if ('problems' in setup) {
  registerSetupFailure(setup.problems);
} else {
  const run = new LiveRun(setup.settings);
  after(() => run.end());
  before(async (t) => {
    t.diagnostic(`Hosted live MFA profile: ${setup.settings.mfaPolicy}.`);
    await assertMfaProfileBeforeLiveProofs(run);
  });
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
