import assert from 'node:assert/strict';
import type { SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { commands, defaults, launcherCase, pnpmCall, randomPassword, settingLines, workos, type Settings } from './fixtures/auth-workos-mcp-url-fetch-script-harness.ts';

const entryArguments = ['exec', 'node', '--import', 'tsx', 'test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts'];
const axiomApiKey = 'private-axiom-key';

function certificateLine(directory: string): string {
  return `Making a new self-signed certificate for localhost in ${directory}, because key.pem or cert.pem is missing there. Trust it as the instructions of the slice say.\n`;
}

function certificateCall(directory: string): string[] {
  return [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'),
    '-days', '365', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1', '-addext', 'extendedKeyUsage=serverAuth',
  ];
}

function refusal(missing: string, script: string): string {
  return `Missing or empty: ${missing}. Start the slice through the staging launcher, which sets the WorkOS settings:\n  node ~/.config/thermus/with-workos-staging.cjs "${script}"\n`;
}

function assertNoSecret(result: SpawnSyncReturns<string>, secrets: readonly string[]): void {
  for (const secret of secrets) assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false, `The output shows the secret ${secret}`);
}

test('Given only the three WorkOS settings and AXIOM_API_KEY, when the script runs from another directory, then pnpm exec runs the entry point with the pinned Node runtime in the repository root with the defaults of the other settings, the redirect URI on the public base URL, a new cookie password from openssl rand, and the keys; stderr lists the eleven settings after the certificate line; and no output shows a secret', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ ...workos, AXIOM_API_KEY: axiomApiKey });

  const settings = defaults(launcher.root);
  assert.deepEqual(pnpmCall(result), {
    arguments: entryArguments,
    directory: launcher.root,
    settings,
    secretsSet: { WORKOS_API_KEY: true, WORKOS_COOKIE_PASSWORD: true, AXIOM_API_KEY: true },
    cookiePasswordLength: randomPassword.length,
  });
  assert.deepEqual(launcher.opensslCalls()[0], ['rand', '-base64', '32']);
  assert.equal(result.stderr, certificateLine(settings.THERMUS_TLS_DIR) + settingLines(settings));
  assertNoSecret(result, [workos.WORKOS_API_KEY, axiomApiKey, randomPassword]);
});

test('Given each setting with a custom value, a cookie password, and a TLS directory with both files, when the script runs, then pnpm gets each value unchanged, openssl does not run, the files stay, and stderr lists the eleven values without the secrets', (t) => {
  const launcher = launcherCase(t);
  const rulesFile = join(launcher.root, 'custom rules.txt');
  const tlsDirectory = join(launcher.root, 'custom tls');
  writeFileSync(rulesFile, '');
  mkdirSync(tlsDirectory);
  writeFileSync(join(tlsDirectory, 'key.pem'), 'kept key\n');
  writeFileSync(join(tlsDirectory, 'cert.pem'), 'kept certificate\n');
  const settings: Settings = {
    DEPLOYMENT: 'self-hosted',
    PUBLIC_BASE_URL: 'https://127.0.0.1:46443',
    WORKOS_CLIENT_ID: 'client_custom',
    WORKOS_AUTHKIT_ISSUER: 'https://custom.authkit.app',
    WORKOS_REDIRECT_URI: 'https://127.0.0.1:46443/custom-callback',
    AD_RULES_FILE: rulesFile,
    LIGHTPANDA_BIN: '/opt/custom lightpanda/lightpanda',
    AXOIM_ENDPOINT_URL: 'https://eu-central-1.aws.edge.axiom.co',
    AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'custom-data-set',
    THERMUS_TLS_DIR: tlsDirectory,
    THERMUS_SLICE_ORGANIZATION_ID: 'org_custom',
  };
  const cookiePassword = 'given-cookie-password-with-forty-chars!!';

  const result = launcher.run({ ...settings, WORKOS_API_KEY: workos.WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD: cookiePassword });

  assert.deepEqual(pnpmCall(result), {
    arguments: entryArguments,
    directory: launcher.root,
    settings,
    secretsSet: { WORKOS_API_KEY: true, WORKOS_COOKIE_PASSWORD: true, AXIOM_API_KEY: false },
    cookiePasswordLength: cookiePassword.length,
  });
  assert.deepEqual(launcher.opensslCalls(), []);
  assert.deepEqual([readFileSync(join(tlsDirectory, 'key.pem'), 'utf8'), readFileSync(join(tlsDirectory, 'cert.pem'), 'utf8')], ['kept key\n', 'kept certificate\n']);
  assert.equal(result.stderr, settingLines(settings));
  assertNoSecret(result, [workos.WORKOS_API_KEY, cookiePassword]);
});

test('Given a PUBLIC_BASE_URL with a final slash and no WORKOS_REDIRECT_URI, when the script runs, then the redirect URI is the callback on that base without a double slash', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ ...workos, PUBLIC_BASE_URL: 'https://localhost:46443/' });

  assert.equal(pnpmCall(result).settings.WORKOS_REDIRECT_URI, 'https://localhost:46443/callback');
});

for (const name of Object.keys(workos)) {
  test(`Given no ${name}, when the script runs, then it exits with status 1 and a message that names ${name} and the staging launcher and shows no value, and neither openssl nor pnpm runs`, (t) => {
    const launcher = launcherCase(t);
    const others = Object.fromEntries(Object.entries(workos).filter(([other]) => other !== name));

    const result = launcher.run({ ...others, AXIOM_API_KEY: axiomApiKey });

    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, refusal(name, launcher.script));
    assert.equal(result.stdout, '');
    assert.deepEqual(launcher.opensslCalls(), []);
    assertNoSecret(result, [...Object.values(others), axiomApiKey]);
  });
}

test('Given the three WorkOS settings with empty values, when the script runs, then it exits with status 1 and the message names the three settings', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ WORKOS_API_KEY: '', WORKOS_CLIENT_ID: '', WORKOS_AUTHKIT_ISSUER: '' });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, refusal('WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_AUTHKIT_ISSUER', launcher.script));
});

test('Given no certificate files, when the script runs two times, then the first run makes key.pem and cert.pem with openssl req in the default TLS directory, which only the owner can read, and says so on stderr; the second run calls no openssl req and keeps the files', (t) => {
  const launcher = launcherCase(t);
  const settings = defaults(launcher.root);
  const tlsDirectory = settings.THERMUS_TLS_DIR;

  const first = launcher.run(workos);
  const firstCalls = launcher.opensslCalls();
  writeFileSync(join(tlsDirectory, 'cert.pem'), 'trusted certificate\n');
  const second = launcher.run(workos);

  assert.deepEqual(firstCalls.filter(([command]) => command === 'req'), [certificateCall(tlsDirectory)]);
  assert.equal(first.stderr, certificateLine(tlsDirectory) + settingLines(settings));
  assert.deepEqual([statSync(tlsDirectory).mode & 0o777, statSync(join(tlsDirectory, 'key.pem')).mode & 0o777], [0o700, 0o600]);
  assert.deepEqual(commands(launcher.opensslCalls().slice(firstCalls.length)), ['rand']);
  assert.equal(second.stderr, settingLines(settings));
  assert.deepEqual([readFileSync(join(tlsDirectory, 'key.pem'), 'utf8'), readFileSync(join(tlsDirectory, 'cert.pem'), 'utf8')], ['test key\n', 'trusted certificate\n']);
});

test('Given a TLS directory with cert.pem only, when the script runs, then it makes a new key.pem and cert.pem', (t) => {
  const launcher = launcherCase(t);
  const tlsDirectory = join(launcher.root, 'half tls');
  mkdirSync(tlsDirectory);
  writeFileSync(join(tlsDirectory, 'cert.pem'), 'old certificate\n');

  const result = launcher.run({ ...workos, THERMUS_TLS_DIR: tlsDirectory });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(launcher.opensslCalls().filter(([command]) => command === 'req'), [certificateCall(tlsDirectory)]);
  assert.equal(readFileSync(join(tlsDirectory, 'cert.pem'), 'utf8'), 'test certificate\n');
});

test('Given an AD_RULES_FILE that does not exist, when the script runs, then it exits with status 1 and a message that names AD_RULES_FILE and the touch command, it makes no certificate, and pnpm does not run', (t) => {
  const launcher = launcherCase(t);
  const missing = join(launcher.root, 'missing-rules.txt');

  const result = launcher.run({ ...workos, AD_RULES_FILE: missing });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, `AD_RULES_FILE=${missing} is not a file. For no ad rules, make an empty file: touch "${missing}"\n`);
  assert.equal(result.stdout, '');
  assert.equal(commands(launcher.opensslCalls()).includes('req'), false);
});

test('Given a repository root without the portal build, when the script runs, then it exits with status 1 and a message that names the missing index.html and npm run build:user-portal, it makes no certificate, and pnpm does not run', (t) => {
  const launcher = launcherCase(t);
  const portalBuild = join(launcher.root, 'src/user-portal/dist/index.html');
  rmSync(portalBuild);

  const result = launcher.run(workos);

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, `The portal build ${portalBuild} is missing. Make it in the repository root: npm run build:user-portal\n`);
  assert.equal(result.stdout, '');
  assert.equal(commands(launcher.opensslCalls()).includes('req'), false);
});

test('Given extra arguments, when the script runs, then pnpm exec gets them after the entry point', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run(workos, ['--first', 'two words']);

  assert.deepEqual(pnpmCall(result).arguments, [...entryArguments, '--first', 'two words']);
});

test('Given a pnpm that exits with status 3, when the script runs, then the script exits with status 3', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ ...workos, FAKE_PNPM_EXIT: '3' });

  assert.equal(result.status, 3, result.stderr);
});
