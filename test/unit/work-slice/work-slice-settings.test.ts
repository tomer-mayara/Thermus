import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { AdRulesFileError } from '../../../src/config/ad-rules-file.ts';
import { DeploymentConfigError } from '../../../src/config/deployment-config.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { readWorkSliceSettings, WorkSliceSettingsError, type WorkSliceSettings } from '../../support/work-slice/work-slice-settings.ts';

type Environment = Record<string, string | undefined>;

const renderer = '/opt/thermus-test/lightpanda';
const rules = 'example.com##.advert\n';
const lightpandaRequired = 'LIGHTPANDA_BIN is required. Set it to the absolute path of the pinned Lightpanda 1.0.0 executable. See docs/lightpanda-runtime.md.';
const defaults: WorkSliceSettings = {
  listen: { host: '127.0.0.1', port: 8080 },
  publicBaseUrl: 'http://127.0.0.1:8080/',
  mcpResourceUrl: 'http://127.0.0.1:8080/mcp',
  resourceMetadataUrl: 'http://127.0.0.1:8080/.well-known/oauth-protected-resource/mcp',
  lightpandaBin: renderer,
  adRules: '',
};

function assignments(settings: Environment): string {
  return Object.entries(settings).map(([name, value]) => `${name}=${value ?? '(missing)'}`).join(' and ');
}

function rulesFile(t: TestContext): string {
  const file = join(dataDirectory(t), 'ad-rules.txt');
  writeFileSync(file, rules);
  return file;
}

function rejection(environment: Environment): WorkSliceSettingsError {
  try {
    readWorkSliceSettings(environment);
  } catch (error) {
    assert.ok(error instanceof WorkSliceSettingsError, `Expected a WorkSliceSettingsError, got ${String(error)}`);
    assert.equal(error.name, 'WorkSliceSettingsError');
    return error;
  }
  return assert.fail('Expected a WorkSliceSettingsError, but the settings loaded.');
}

function urls(settings: WorkSliceSettings): string[] {
  return [settings.publicBaseUrl, settings.mcpResourceUrl, settings.resourceMetadataUrl];
}

for (const unset of [{}, { LISTEN_HOST: '', LISTEN_PORT: '', PUBLIC_BASE_URL: '', AD_RULES_FILE: '' }]) {
  test(`Given only LIGHTPANDA_BIN${Object.keys(unset).length === 0 ? '' : ' and empty optional settings'}, when the work-slice settings load, then they use the loopback address, port 8080, the derived URLs, and no ad rules`, () => {
    const settings = readWorkSliceSettings({ ...unset, LIGHTPANDA_BIN: renderer });
    assert.deepEqual(settings, defaults);
    assert.ok(Object.isFrozen(settings));
  });
}

const defaultBaseUrls: ReadonlyArray<[Environment, string[]]> = [
  [{ LISTEN_HOST: '::1', LISTEN_PORT: '8443' },
    ['http://[::1]:8443/', 'http://[::1]:8443/mcp', 'http://[::1]:8443/.well-known/oauth-protected-resource/mcp']],
  [{ LISTEN_HOST: 'localhost', LISTEN_PORT: '9090' },
    ['http://localhost:9090/', 'http://localhost:9090/mcp', 'http://localhost:9090/.well-known/oauth-protected-resource/mcp']],
];
for (const [listen, expected] of defaultBaseUrls) {
  test(`Given ${assignments(listen)} and no PUBLIC_BASE_URL, when the work-slice settings load, then the default base URL uses that host and port`, () => {
    const settings = readWorkSliceSettings({ ...listen, LIGHTPANDA_BIN: renderer });
    assert.deepEqual(settings.listen, { host: listen.LISTEN_HOST, port: Number(listen.LISTEN_PORT) });
    assert.deepEqual(urls(settings), expected);
  });
}

const publicBaseUrls: ReadonlyArray<[string, string[]]> = [
  ['http://127.0.0.1:8080', ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080/mcp', 'http://127.0.0.1:8080/.well-known/oauth-protected-resource/mcp']],
  ['https://thermus.example/', ['https://thermus.example/', 'https://thermus.example/mcp', 'https://thermus.example/.well-known/oauth-protected-resource/mcp']],
  ['https://thermus.example/team', ['https://thermus.example/team/', 'https://thermus.example/team/mcp', 'https://thermus.example/.well-known/oauth-protected-resource/team/mcp']],
  ['https://thermus.example/team/', ['https://thermus.example/team/', 'https://thermus.example/team/mcp', 'https://thermus.example/.well-known/oauth-protected-resource/team/mcp']],
];
for (const [base, expected] of publicBaseUrls) {
  test(`Given PUBLIC_BASE_URL=${base}, when the work-slice settings load, then they derive the base URL with a final slash, the MCP resource, and the metadata URL, and keep the listen address`, () => {
    const settings = readWorkSliceSettings({ PUBLIC_BASE_URL: base, LIGHTPANDA_BIN: renderer });
    assert.deepEqual(urls(settings), expected);
    assert.deepEqual(settings.listen, defaults.listen);
  });
}

const refusedBaseUrls: ReadonlyArray<[string, string, string]> = [
  ['a username and a password', 'https://private-value:secret@thermus.example/', 'PUBLIC_BASE_URL must not contain a username or password.'],
  ['a username', 'https://private-value@thermus.example/', 'PUBLIC_BASE_URL must not contain a username or password.'],
  ['a query', 'https://thermus.example/?private-value=1', 'PUBLIC_BASE_URL must not contain a query.'],
  ['an empty query', 'https://private-value.example/?', 'PUBLIC_BASE_URL must not contain a query.'],
  ['a fragment', 'https://thermus.example/#private-value', 'PUBLIC_BASE_URL must not contain a fragment.'],
  ['an empty fragment', 'https://private-value.example/#', 'PUBLIC_BASE_URL must not contain a fragment.'],
  ['an ftp scheme', 'ftp://private-value.example/', 'PUBLIC_BASE_URL must use http or https.'],
  ['a file scheme', 'file:///private-value/thermus', 'PUBLIC_BASE_URL must use http or https.'],
  ['a relative URL', 'private-value.example/team', 'PUBLIC_BASE_URL must be an absolute URL.'],
  ['a path only', '/private-value/team', 'PUBLIC_BASE_URL must be an absolute URL.'],
];
for (const [problem, base, message] of refusedBaseUrls) {
  test(`Given a PUBLIC_BASE_URL with ${problem}, when the work-slice settings load, then they refuse it with the rule and without the value`, () => {
    const error = rejection({ PUBLIC_BASE_URL: base, LIGHTPANDA_BIN: renderer });
    assert.equal(error.message, message);
    assert.ok(!error.message.includes('private-value'), error.message);
  });
}

test('Given LISTEN_PORT=0, when the work-slice settings load, then they refuse the port, because the client URL must be known before the server listens', () => {
  const error = rejection({ LISTEN_PORT: '0', LIGHTPANDA_BIN: renderer });
  assert.equal(error.message, 'LISTEN_PORT must not be 0 for the work slice: the client URL must be known before the server listens.');
});

test('Given a LISTEN_PORT that is not a port number, when the work-slice settings load, then the DeploymentConfigError of the listen address passes through unchanged', () => {
  assert.throws(() => readWorkSliceSettings({ LISTEN_PORT: 'http', LIGHTPANDA_BIN: renderer }), (error) => {
    assert.ok(error instanceof DeploymentConfigError, `Expected a DeploymentConfigError, got ${String(error)}`);
    assert.equal(error.message, 'LISTEN_PORT must be a whole number from 0 to 65535.');
    return true;
  });
});

for (const value of [undefined, '']) {
  test(`Given ${value === undefined ? 'no' : 'an empty'} LIGHTPANDA_BIN, when the work-slice settings load, then they refuse the missing setting and name the runtime document`, () => {
    assert.equal(rejection({ LIGHTPANDA_BIN: value }).message, lightpandaRequired);
  });
}

for (const value of ['lightpanda', './bin/lightpanda', '~/lightpanda']) {
  test(`Given LIGHTPANDA_BIN=${JSON.stringify(value)}, when the work-slice settings load, then they refuse the relative path`, () => {
    assert.equal(rejection({ LIGHTPANDA_BIN: value }).message, 'LIGHTPANDA_BIN must be an absolute path.');
  });
}

test('Given AD_RULES_FILE names a rules file, when the work-slice settings load, then the ad rules are the contents of the file', (t) => {
  const settings = readWorkSliceSettings({ AD_RULES_FILE: rulesFile(t), LIGHTPANDA_BIN: renderer });
  assert.deepEqual(settings, { ...defaults, adRules: rules });
});

test('Given a relative AD_RULES_FILE, when the work-slice settings load, then the AdRulesFileError of the rules reader passes through unchanged', () => {
  assert.throws(() => readWorkSliceSettings({ AD_RULES_FILE: 'ad-rules.txt', LIGHTPANDA_BIN: renderer }), (error) => {
    assert.ok(error instanceof AdRulesFileError, `Expected an AdRulesFileError, got ${String(error)}`);
    assert.equal(error.message, 'AD_RULES_FILE must be an absolute path.');
    return true;
  });
});

test('Given each setting only in process.env, when the work-slice settings load from a record with only LIGHTPANDA_BIN, then they ignore process.env', (t) => {
  t.mock.property(process, 'env', {
    ...process.env,
    LISTEN_HOST: '0.0.0.0', LISTEN_PORT: '9999', PUBLIC_BASE_URL: 'https://private-environment.example/',
    LIGHTPANDA_BIN: '/opt/private-environment/lightpanda', AD_RULES_FILE: rulesFile(t),
  });
  assert.deepEqual(readWorkSliceSettings({ LIGHTPANDA_BIN: renderer }), defaults);
});
