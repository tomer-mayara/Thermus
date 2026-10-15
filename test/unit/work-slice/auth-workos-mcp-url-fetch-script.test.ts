import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/data-directory.ts';

// The script finds the repository root from its own place. Each case runs a copy of the script in a temporary root, so
// that the case chooses the rules file, the portal build, and the certificate files, and the real root stays unchanged.
const scriptPath = 'test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh';
const sourceScript = fileURLToPath(new URL(`${import.meta.url.endsWith('.ts') ? '../../../' : '../../../../'}${scriptPath}`, import.meta.url));
const entryArguments = ['exec', 'node', '--import', 'tsx', 'test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts'];
const settingNames = [
  'DEPLOYMENT', 'PUBLIC_BASE_URL', 'WORKOS_CLIENT_ID', 'WORKOS_AUTHKIT_ISSUER', 'WORKOS_REDIRECT_URI', 'AD_RULES_FILE',
  'LIGHTPANDA_BIN', 'AXOIM_ENDPOINT_URL', 'AXIOM_SYSTEM_LOG_TEST_DATA_SET', 'THERMUS_TLS_DIR',
] as const;
const secretNames = ['WORKOS_API_KEY', 'WORKOS_COOKIE_PASSWORD', 'AXIOM_API_KEY'] as const;
type Settings = Record<(typeof settingNames)[number], string>;
type SecretsSet = Record<(typeof secretNames)[number], boolean>;

const workos = { WORKOS_API_KEY: 'sk_test_private-api-key', WORKOS_CLIENT_ID: 'client_test', WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app' };
const axiomApiKey = 'private-axiom-key';
// The value of the openssl double for rand -base64 32: 32 bytes give 44 characters.
const randomPassword = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

interface PnpmCall {
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly settings: Settings;
  readonly secretsSet: SecretsSet;
  readonly cookiePasswordLength: number;
}

// The values of these cases have no quote and no backslash, so the double writes them into JSON as they are. Of a
// secret it writes only whether it is set, and the length of the cookie password, so that no output shows a secret.
const fakePnpm = `#!/bin/sh
arguments=
for argument in "$@"; do arguments="$arguments$(printf ',"%s"' "$argument")"; done
printf '{"arguments":[%s],"directory":"%s","settings":{${settingNames.map((name) => `"${name}":"%s"`).join(',')}},"secretsSet":{${secretNames.map((name) => `"${name}":%s`).join(',')}},"cookiePasswordLength":%s}\\n' \\
  "\${arguments#,}" "$(pwd -P)" ${settingNames.map((name) => `"$${name}"`).join(' ')} \\
  ${secretNames.map((name) => `"$([ -n "\${${name}+set}" ] && echo true || echo false)"`).join(' ')} "\${#WORKOS_COOKIE_PASSWORD}"
exit "\${FAKE_PNPM_EXIT:-0}"
`;

function fakeOpenssl(calls: string): string {
  return `#!/bin/sh
call=
for argument in "$@"; do call="$call$(printf ',"%s"' "$argument")"; done
printf '[%s]\\n' "\${call#,}" >> '${calls}'
case "$1" in
  rand) printf '%s\\n' '${randomPassword}' ;;
  req)
    while [ "$#" -gt 0 ]; do
      case "$1" in
        -keyout) printf 'test key\\n' > "$2" ;;
        -out) printf 'test certificate\\n' > "$2" ;;
      esac
      shift
    done ;;
esac
`;
}

interface LauncherCase {
  // The physical path, as the script finds it.
  readonly root: string;
  readonly script: string;
  run(variables: Readonly<Record<string, string>>, args?: readonly string[]): SpawnSyncReturns<string>;
  opensslCalls(): string[][];
}

function launcherCase(t: TestContext): LauncherCase {
  const directory = realpathSync(dataDirectory(t));
  const root = join(directory, 'root');
  const script = join(root, scriptPath);
  const bin = join(directory, 'bin');
  const home = join(directory, 'home');
  const calls = join(directory, 'openssl-calls');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(sourceScript, script);
  mkdirSync(join(root, 'src/user-portal/dist'), { recursive: true });
  writeFileSync(join(root, 'src/user-portal/dist/index.html'), '<!doctype html>\n');
  writeFileSync(join(root, 'ad-rules.txt'), '');
  mkdirSync(bin);
  mkdirSync(home);
  writeFileSync(join(bin, 'pnpm'), fakePnpm, { mode: 0o755 });
  writeFileSync(join(bin, 'openssl'), fakeOpenssl(calls), { mode: 0o755 });
  writeFileSync(calls, '');
  return {
    root,
    script,
    run: (variables, args = []) => spawnSync('bash', [script, ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10_000,
      // Not process.env: a setting of the shell that runs the tests must not get to the script.
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, ...variables },
    }),
    opensslCalls: () => readFileSync(calls, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as string[]),
  };
}

function defaults(root: string): Settings {
  return {
    DEPLOYMENT: 'hosted',
    PUBLIC_BASE_URL: 'https://localhost:46443',
    WORKOS_CLIENT_ID: workos.WORKOS_CLIENT_ID,
    WORKOS_AUTHKIT_ISSUER: workos.WORKOS_AUTHKIT_ISSUER,
    WORKOS_REDIRECT_URI: 'https://localhost:46443/callback',
    AD_RULES_FILE: join(root, 'ad-rules.txt'),
    LIGHTPANDA_BIN: join(root, '.cache/lightpanda/1.0.0/lightpanda'),
    AXOIM_ENDPOINT_URL: 'https://us-east-1.aws.edge.axiom.co',
    AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'system-log-test',
    THERMUS_TLS_DIR: join(root, '.cache/thermus-local-tls'),
  };
}

function pnpmCall(result: SpawnSyncReturns<string>): PnpmCall {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as PnpmCall;
}

function settingLines(settings: Settings): string {
  return settingNames.map((name) => `${name}=${settings[name]}\n`).join('');
}

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

function commands(calls: readonly string[][]): string[] {
  return calls.map(([command]) => command);
}

function assertNoSecret(result: SpawnSyncReturns<string>, secrets: readonly string[]): void {
  for (const secret of secrets) assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false, `The output shows the secret ${secret}`);
}

test('Given only the three WorkOS settings and AXIOM_API_KEY, when the script runs from another directory, then pnpm exec runs the entry point with the pinned Node runtime in the repository root with the defaults of the other settings, the redirect URI on the public base URL, a new cookie password from openssl rand, and the keys; stderr lists the ten settings after the certificate line; and no output shows a secret', (t) => {
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

test('Given each setting with a custom value, a cookie password, and a TLS directory with both files, when the script runs, then pnpm gets each value unchanged, openssl does not run, the files stay, and stderr lists the ten values without the secrets', (t) => {
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
