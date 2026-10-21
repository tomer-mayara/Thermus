import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { repositoryRoot } from '../../../support/processes/module-paths.ts';

// The harness of the script test of the auth WorkOS MCP URL fetch slice. The script finds the repository root from
// its own place. Each case runs a copy of the script in a temporary root, so that the case chooses the rules file, the
// portal build, and the certificate files, and the real root stays unchanged.
const scriptPath = 'test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh';
const sourceScript = fileURLToPath(new URL(scriptPath, repositoryRoot));
const settingNames = [
  'DEPLOYMENT', 'PUBLIC_BASE_URL', 'WORKOS_CLIENT_ID', 'WORKOS_AUTHKIT_ISSUER', 'WORKOS_REDIRECT_URI', 'AD_RULES_FILE',
  'LIGHTPANDA_BIN', 'AXOIM_ENDPOINT_URL', 'AXIOM_SYSTEM_LOG_TEST_DATA_SET', 'THERMUS_TLS_DIR', 'THERMUS_SLICE_ORGANIZATION_ID',
] as const;
const secretNames = ['WORKOS_API_KEY', 'WORKOS_COOKIE_PASSWORD', 'AXIOM_API_KEY'] as const;
export type Settings = Record<(typeof settingNames)[number], string>;
type SecretsSet = Record<(typeof secretNames)[number], boolean>;

export const workos = { WORKOS_API_KEY: 'sk_test_private-api-key', WORKOS_CLIENT_ID: 'client_test', WORKOS_AUTHKIT_ISSUER: 'https://thermus-test.authkit.app' };
// The value of the openssl double for rand -base64 32: 32 bytes give 44 characters.
export const randomPassword = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

interface PnpmCall {
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly settings: Settings;
  readonly secretsSet: SecretsSet;
  readonly cookiePasswordLength: number;
}

// The values of the cases have no quote and no backslash, so the double writes them into JSON as they are. Of a
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

interface ScriptHarness {
  // The physical path, as the script finds it.
  readonly root: string;
  readonly script: string;
  run(variables: Readonly<Record<string, string>>, args?: readonly string[]): SpawnSyncReturns<string>;
  opensslCalls(): string[][];
}

export function scriptHarness(t: TestContext): ScriptHarness {
  const directory = realpathSync(dataDirectory(t));
  const root = join(directory, 'root');
  const script = join(root, scriptPath);
  const bin = join(directory, 'bin');
  const home = join(directory, 'home');
  const calls = join(directory, 'openssl-calls');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(sourceScript, script);
  mkdirSync(join(root, 'src/interfaces/user-portal/dist'), { recursive: true });
  writeFileSync(join(root, 'src/interfaces/user-portal/dist/index.html'), '<!doctype html>\n');
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

export function defaults(root: string): Settings {
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
    THERMUS_SLICE_ORGANIZATION_ID: 'org_01M4YYEQ6V2ZBM3RQEEV8CKFEA',
  };
}

export function pnpmCall(result: SpawnSyncReturns<string>): PnpmCall {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as PnpmCall;
}

export function settingLines(settings: Settings): string {
  return settingNames.map((name) => `${name}=${settings[name]}\n`).join('');
}

export function commands(calls: readonly string[][]): string[] {
  return calls.map(([command]) => command);
}
