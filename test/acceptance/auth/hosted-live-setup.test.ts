import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

type GateSettings = Readonly<Record<string, string>>;
type PackageScripts = Readonly<Record<string, string>>;

interface GateRun {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

const liveFile = fileURLToPath(new URL('./hosted.live.js', import.meta.url));
// With --import before --test, the blocker loads in the process that runs the test file. There, each outbound attempt fails and writes a line to the report.
const networkBlocker = new URL('../../support/deny-network.js', import.meta.url).href;
const repositoryRoot = new URL('../../../../', import.meta.url);
const liveCommand = 'npm run build && npm run build:user-portal && node --test dist/test/acceptance/auth/hosted.live.js';
const liveSource = 'test/acceptance/auth/hosted.live.ts';
const liveOutput = 'dist/test/acceptance/auth/hosted.live.js';
const setupSpecificationOutput = 'dist/test/acceptance/auth/hosted-live-setup.test.js';
const suiteScripts = ['test', 'test:unit', 'test:integration', 'test:acceptance', 'test:interface'];
const settingNames = ['WORKOS_API_KEY', 'WORKOS_CLIENT_ID', 'WORKOS_AUTHKIT_ISSUER'] as const;
const setupTestResult = /^not ok 1 - Given the hosted live gate, when it starts, then the WorkOS staging settings are present$/m;
const setupErrorText = [
  /^\s*Hosted live setup error\. The hosted live gate did not start its live proofs:$/m,
  /^\s*Set these settings for a WorkOS staging environment\. Then run npm run test:hosted-live again\.$/m,
  /^\s*A setup error is not a pass of the hosted live gate\.$/m,
  /docs\/implementation\/test-gate-policy\.md/,
];
const problemLine = /^\s*- (WORKOS_\w+ .*)$/gm;
const summaryLine = /^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm;
const outboundAttempt = /Outbound network access attempted/;
const issuerRefusal = 'WORKOS_AUTHKIT_ISSUER is refused: it must be an absolute https URL without spaces, a username, a password, a query, or a fragment.';
const gateTimeout = 30_000;
const caseOptions = { timeout: 60_000 };

function secretLike(): string {
  return randomBytes(16).toString('hex');
}

function stagingSettings(): GateSettings {
  return {
    WORKOS_API_KEY: `sk_test_${secretLike()}`,
    WORKOS_CLIENT_ID: 'client_hosted_live_setup',
    WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
  };
}

// The parent runner sets NODE_TEST_CONTEXT, which changes the reporter of the gate runner. WorkOS settings of the caller must not reach the gate.
function gateEnvironment(settings: GateSettings): NodeJS.ProcessEnv {
  const inherited = Object.entries(process.env).filter(([name]) => name !== 'NODE_TEST_CONTEXT' && !name.startsWith('WORKOS_'));
  return { ...Object.fromEntries(inherited), ...settings };
}

async function runGate(t: TestContext, settings: GateSettings): Promise<GateRun> {
  const args = ['--import', networkBlocker, '--test', '--test-reporter=tap', liveFile];
  const child = spawn(process.execPath, args, { env: gateEnvironment(settings), stdio: ['ignore', 'pipe', 'pipe'], timeout: gateTimeout });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  const [code, signal] = await once(child, 'close');
  return { code, signal, stdout, stderr };
}

function outputOf(run: GateRun): string {
  return `${run.stdout}${run.stderr}`;
}

function tapSummary(run: GateRun): Readonly<Record<string, number>> {
  return Object.fromEntries([...run.stdout.matchAll(summaryLine)].map(([, name, count]) => [name, Number(count)]));
}

function problemsIn(run: GateRun): string[] {
  return [...run.stdout.matchAll(problemLine)].map(([, problem]) => problem ?? '');
}

function assertExitOne(run: GateRun): void {
  assert.equal(run.code, 1, `The gate stopped with code ${run.code} and signal ${run.signal}.\n${outputOf(run)}`);
}

function assertSetupFailure(run: GateRun): void {
  const output = outputOf(run);
  assertExitOne(run);
  assert.deepEqual(tapSummary(run), { tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0 }, output);
  assert.match(run.stdout, setupTestResult);
  for (const text of setupErrorText) assert.match(run.stdout, text);
  assert.doesNotMatch(output, outboundAttempt);
}

function assertShowsNoValue(run: GateRun, settings: GateSettings): void {
  for (const [name, value] of Object.entries(settings)) {
    if (value !== '') assert.ok(!outputOf(run).includes(value), `The gate output shows the value of ${name}.`);
  }
}

function packageScripts(): PackageScripts {
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8')) as { scripts: PackageScripts };
  return scripts;
}

function suiteGlob(scripts: PackageScripts, name: string): string {
  const glob = /node --test "([^"]+)"/.exec(scripts[name] ?? '')?.[1];
  assert.ok(glob, `The ${name} script has no quoted test glob.`);
  return glob;
}

describe('Setup gate of the hosted live command', () => {
  test('Given no WorkOS settings, when the hosted live gate runs, then it exits 1 with one failed test and no skipped or todo test, its setup error names WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_AUTHKIT_ISSUER as missing, and it attempts no outbound network access', caseOptions, async (t) => {
    const run = await runGate(t, {});

    assertSetupFailure(run);
    assert.deepEqual(problemsIn(run), settingNames.map((name) => `${name} is missing or empty.`));
  });

  test('Given a production API key with the other settings, when the hosted live gate runs, then its setup error refuses the key and requires a staging key, and the output never shows the key or another setting value', caseOptions, async (t) => {
    const secret = secretLike();
    const settings = { ...stagingSettings(), WORKOS_API_KEY: `sk_live_${secret}` };

    const run = await runGate(t, settings);

    assertSetupFailure(run);
    const [problem, ...others] = problemsIn(run);
    assert.match(problem ?? '', /^WORKOS_API_KEY is refused: it is not a WorkOS staging key\. .*only a staging key that starts with sk_test_\.$/);
    assert.deepEqual(others, []);
    assertShowsNoValue(run, settings);
    assert.ok(!outputOf(run).includes(secret), 'The gate output shows the secret part of the key.');
  });

  for (const name of settingNames) {
    test(`Given an empty ${name} with the other settings, when the hosted live gate runs, then the empty value counts as missing`, caseOptions, async (t) => {
      const settings = { ...stagingSettings(), [name]: '' };

      const run = await runGate(t, settings);

      assertSetupFailure(run);
      assert.deepEqual(problemsIn(run), [`${name} is missing or empty.`]);
      assertShowsNoValue(run, settings);
    });
  }

  test('Given an AuthKit issuer that is not an absolute https URL without spaces, a username, a password, a query, or a fragment, when the hosted live gate runs, then its setup error refuses the issuer and shows no value', caseOptions, async (t) => {
    const issuers = [
      'magumagu-test.authkit.app',
      'http://magumagu-test.authkit.app',
      'https://operator:secret@magumagu-test.authkit.app',
      'https://magumagu-test.authkit.app?organization=a',
      'https://magumagu-test.authkit.app#a',
      'https://magumagu-test.authkit.app ',
    ];

    const runs = await Promise.all(issuers.map(async (issuer) => {
      const settings = { ...stagingSettings(), WORKOS_AUTHKIT_ISSUER: issuer };
      return { settings, run: await runGate(t, settings) };
    }));

    for (const { settings, run } of runs) {
      assertSetupFailure(run);
      assert.deepEqual(problemsIn(run), [issuerRefusal], settings.WORKOS_AUTHKIT_ISSUER);
      assertShowsNoValue(run, settings);
    }
  });

  test('Given staging settings and outbound access denied, when the hosted live gate runs, then its live proofs run, try the network, and fail; no test passes or is skipped, and the output never shows the API key', caseOptions, async (t) => {
    const settings = stagingSettings();

    const run = await runGate(t, settings);
    const summary = tapSummary(run);

    const output = outputOf(run);
    assertExitOne(run);
    assert.ok((summary.tests ?? 0) > 1, output);
    assert.deepEqual(summary, { tests: summary.tests, pass: 0, fail: summary.tests, cancelled: 0, skipped: 0, todo: 0 }, output);
    assert.match(output, outboundAttempt);
    assert.doesNotMatch(output, /Hosted live setup error/);
    assertShowsNoValue(run, { WORKOS_API_KEY: settings.WORKOS_API_KEY });
  });

  test('Given the package scripts, when the suite commands select compiled tests, then only test:hosted-live runs the hosted live file, and the acceptance suite runs this setup specification', () => {
    const scripts = packageScripts();

    assert.equal(scripts['test:hosted-live'], liveCommand);
    assert.ok(existsSync(new URL(liveSource, repositoryRoot)), `${liveSource} does not exist.`);
    assert.doesNotMatch(liveSource, /\.test\.ts$/);
    for (const name of suiteScripts) {
      assert.equal(matchesGlob(liveOutput, suiteGlob(scripts, name)), false, `${name} selects ${liveOutput}.`);
    }
    assert.ok(matchesGlob(setupSpecificationOutput, suiteGlob(scripts, 'test:acceptance')), `test:acceptance does not select ${setupSpecificationOutput}.`);
  });
});
