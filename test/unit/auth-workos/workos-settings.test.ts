import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  browserSessionIssuer,
  loadWorkOSSettings,
  workosAuthority,
  WorkOSSettingsError,
  type WorkOSSettings,
} from '../../../src/auth/hosted-auth/workos/workos-settings.ts';

type Environment = Record<string, string | undefined>;

const publicBaseUrl = 'https://thermus.example/team/';
const valid = {
  WORKOS_API_KEY: 'sk_test_settings_0123456789',
  WORKOS_CLIENT_ID: 'client_01SETTINGS',
  WORKOS_AUTHKIT_ISSUER: 'https://example-staging.authkit.app',
  WORKOS_REDIRECT_URI: 'https://thermus.example/team/callback',
  WORKOS_COOKIE_PASSWORD: 'cookie-password-of-thirty-two-ch',
} as const;

function refusal(overrides: Environment): string {
  const environment: Environment = { ...valid, ...overrides };
  let message = '';
  assert.throws(() => loadWorkOSSettings(environment, publicBaseUrl), (error) => {
    assert.ok(error instanceof WorkOSSettingsError, `Expected a WorkOSSettingsError, got ${String(error)}`);
    message = error.message;
    return true;
  });
  const leaked = Object.values(environment).filter((value) => value !== undefined && value !== '' && message.includes(value));
  assert.deepEqual(leaked, [], 'The message must not contain a setting value.');
  return message;
}

test('Given valid WorkOS settings, when they load, then the provider gets each value exactly as written', () => {
  const settings = loadWorkOSSettings(valid, publicBaseUrl);

  assert.deepEqual(settings, {
    apiKey: valid.WORKOS_API_KEY,
    clientId: valid.WORKOS_CLIENT_ID,
    authkitIssuer: valid.WORKOS_AUTHKIT_ISSUER,
    redirectUri: valid.WORKOS_REDIRECT_URI,
    cookiePassword: valid.WORKOS_COOKIE_PASSWORD,
  } satisfies WorkOSSettings);
  assert.ok(Object.isFrozen(settings));
});

test('Given no WorkOS setting, when they load, then one error names each missing setting', () => {
  const message = refusal(Object.fromEntries(Object.keys(valid).map((name) => [name, undefined])));

  for (const name of Object.keys(valid)) assert.match(message, new RegExp(`${name} is not valid: it is missing or empty\\.`));
  assert.match(message, /The hosted edition gives no access without its WorkOS provider\./);
});

test('Given an empty WorkOS setting, when they load, then it counts as missing', () => {
  assert.match(refusal({ WORKOS_CLIENT_ID: '' }), /WORKOS_CLIENT_ID is not valid: it is missing or empty\./);
});

const refusedValues: ReadonlyArray<readonly [string, string, RegExp]> = [
  ['WORKOS_API_KEY', 'client_01NOTAKEY', /starts with sk_/],
  ['WORKOS_API_KEY', 'sk_test_with space', /spaces or control characters/],
  ['WORKOS_CLIENT_ID', 'sk_test_notaclient', /starts with client_/],
  ['WORKOS_AUTHKIT_ISSUER', 'http://example-staging.authkit.app', /https origin/],
  ['WORKOS_AUTHKIT_ISSUER', 'https://example-staging.authkit.app/', /without a path, a final slash/],
  ['WORKOS_AUTHKIT_ISSUER', 'https://example-staging.authkit.app/oauth2', /https origin/],
  ['WORKOS_AUTHKIT_ISSUER', 'https://user@example-staging.authkit.app', /https origin/],
  ['WORKOS_AUTHKIT_ISSUER', 'https://example-staging.authkit.app?x=1', /https origin/],
  ['WORKOS_AUTHKIT_ISSUER', 'not a url', /https origin/],
  ['WORKOS_REDIRECT_URI', 'http://thermus.example/team/callback', /https URL on the origin of PUBLIC_BASE_URL/],
  ['WORKOS_REDIRECT_URI', 'https://other.example/team/callback', /https URL on the origin of PUBLIC_BASE_URL/],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/teamevil/callback', /inside its path/],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/callback', /inside its path/],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/team/callback?next=1', /without a username, a password, a query, or a fragment/],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/team/callback#done', /without a username, a password, a query, or a fragment/],
  ['WORKOS_REDIRECT_URI', 'https://THERMUS.example/team/callback', /as the URL parser writes it/],
  ['WORKOS_REDIRECT_URI', 'https://thermus.example/team/../team/callback', /as the URL parser writes it/],
  ['WORKOS_COOKIE_PASSWORD', 'short-password-of-31-characters', /at least 32 characters/],
];
for (const [name, value, rule] of refusedValues) {
  test(`Given ${name} with a refused value (${rule.source}), when the settings load, then the error names the setting and the rule but not the value`, () => {
    const message = refusal({ [name]: value });

    assert.match(message, new RegExp(`${name} is not valid: `));
    assert.match(message, rule);
  });
}

test('Given the environment client ID, when the authority and the browser issuer are derived, then both come from the client ID only', () => {
  assert.equal(workosAuthority('client_01SETTINGS'), 'workos:client_01SETTINGS');
  assert.equal(browserSessionIssuer('client_01SETTINGS'), 'https://api.workos.com/user_management/client_01SETTINGS');
});
