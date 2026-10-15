import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';

const script = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../../../test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh' : '../../../../test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh', import.meta.url));
const physicalRoot = realpathSync(fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? '../../../' : '../../../../', import.meta.url)));
const entryArguments = ['exec', 'node', '--import', 'tsx', 'test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts'];
const settingNames = ['PUBLIC_BASE_URL', 'AD_RULES_FILE', 'LIGHTPANDA_BIN', 'AXOIM_ENDPOINT_URL', 'AXIOM_SYSTEM_LOG_TEST_DATA_SET'] as const;
type Settings = Record<(typeof settingNames)[number], string>;

const defaults: Omit<Settings, 'AD_RULES_FILE'> = {
  PUBLIC_BASE_URL: 'http://127.0.0.1:8080',
  LIGHTPANDA_BIN: join(physicalRoot, '.cache/lightpanda/1.0.0/lightpanda'),
  AXOIM_ENDPOINT_URL: 'https://us-east-1.aws.edge.axiom.co',
  AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'system-log-test',
};

interface PnpmCall {
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly settings: Settings;
  readonly axiomApiKeySet: boolean;
}

const fakePnpm = `#!/bin/sh
arguments=
for argument in "$@"; do arguments="$arguments$(printf ',"%s"' "$argument")"; done
if [ -n "\${AXIOM_API_KEY+set}" ]; then key=true; else key=false; fi
printf '{"arguments":[%s],"directory":"%s","settings":{"PUBLIC_BASE_URL":"%s","AD_RULES_FILE":"%s","LIGHTPANDA_BIN":"%s","AXOIM_ENDPOINT_URL":"%s","AXIOM_SYSTEM_LOG_TEST_DATA_SET":"%s"},"axiomApiKeySet":%s}\\n' \\
  "\${arguments#,}" "$(pwd -P)" "$PUBLIC_BASE_URL" "$AD_RULES_FILE" "$LIGHTPANDA_BIN" "$AXOIM_ENDPOINT_URL" "$AXIOM_SYSTEM_LOG_TEST_DATA_SET" "$key"
exit "\${FAKE_PNPM_EXIT:-0}"
`;

interface LauncherCase {
  readonly directory: string;
  readonly emptyRulesFile: string;
  run(variables: Readonly<Record<string, string>>, args?: readonly string[]): SpawnSyncReturns<string>;
}

function launcherCase(t: TestContext): LauncherCase {
  const directory = dataDirectory(t);
  const bin = join(directory, 'bin');
  const home = join(directory, 'home');
  mkdirSync(bin);
  mkdirSync(home);
  writeFileSync(join(bin, 'pnpm'), fakePnpm, { mode: 0o755 });
  const emptyRulesFile = join(directory, 'ad-rules.txt');
  writeFileSync(emptyRulesFile, '');
  return {
    directory,
    emptyRulesFile,
    run: (variables, args = []) => spawnSync('bash', [script, ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10_000,
      // Not process.env: a setting of the shell that runs the tests must not get to the script.
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, ...variables },
    }),
  };
}

function pnpmCall(result: SpawnSyncReturns<string>): PnpmCall {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as PnpmCall;
}

function settingLines(settings: Settings): string {
  return settingNames.map((name) => `${name}=${settings[name]}\n`).join('');
}

test(`Given only AD_RULES_FILE with an empty file and AXIOM_API_KEY, when the script runs from another directory, then pnpm exec runs the entry point with the pinned Node runtime in the repository root with the defaults of the other four settings and the key, stderr lists the five settings, and no output shows the key`, (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ AD_RULES_FILE: launcher.emptyRulesFile, AXIOM_API_KEY: 'private-value' });

  const settings: Settings = { ...defaults, AD_RULES_FILE: launcher.emptyRulesFile };
  assert.deepEqual(pnpmCall(result), { arguments: entryArguments, directory: physicalRoot, settings, axiomApiKeySet: true });
  assert.equal(result.stderr, settingLines(settings));
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-value/);
});

test('Given each of the five settings with a custom value, when the script runs, then pnpm gets each value unchanged, and stderr lists these values', (t) => {
  const launcher = launcherCase(t);
  const rulesFile = join(launcher.directory, 'custom rules.txt');
  writeFileSync(rulesFile, '');
  const settings: Settings = {
    PUBLIC_BASE_URL: 'http://127.0.0.1:9090',
    AD_RULES_FILE: rulesFile,
    LIGHTPANDA_BIN: '/opt/custom lightpanda/lightpanda',
    AXOIM_ENDPOINT_URL: 'https://eu-central-1.aws.edge.axiom.co',
    AXIOM_SYSTEM_LOG_TEST_DATA_SET: 'custom-data-set',
  };

  const result = launcher.run(settings);

  assert.deepEqual(pnpmCall(result), { arguments: entryArguments, directory: physicalRoot, settings, axiomApiKeySet: false });
  assert.equal(result.stderr, settingLines(settings));
});

test('Given extra arguments, when the script runs, then pnpm exec gets them after the entry point', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ AD_RULES_FILE: launcher.emptyRulesFile }, ['--first', 'two words']);

  assert.deepEqual(pnpmCall(result).arguments, [...entryArguments, '--first', 'two words']);
});

test('Given an AD_RULES_FILE that does not exist, when the script runs, then it exits with status 1 and a message that names AD_RULES_FILE and the touch command, and pnpm does not run', (t) => {
  const launcher = launcherCase(t);
  const missing = join(launcher.directory, 'missing-rules.txt');

  const result = launcher.run({ AD_RULES_FILE: missing });

  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stderr, `AD_RULES_FILE=${missing} is not a file. For no ad rules, make an empty file: touch "${missing}"\n`);
  assert.equal(result.stdout, '');
});

test('Given a pnpm that exits with status 3, when the script runs, then the script exits with status 3', (t) => {
  const launcher = launcherCase(t);

  const result = launcher.run({ AD_RULES_FILE: launcher.emptyRulesFile, FAKE_PNPM_EXIT: '3' });

  assert.equal(result.status, 3, result.stderr);
});
