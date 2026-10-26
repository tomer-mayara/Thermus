import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, delimiter } from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';

const root = process.cwd();
const cache = resolve(root, '.cache/pr251-rebase-8c6d204e');
const validation = resolve(cache, 'validation');
const base = '8c6d204e8588a664438ba8934ab36670b802525f';
const expectedHead = 'fd7fa0b1e53d653f92168b75ba4d65618a9138a8';
const context = 'colima-thermus-pr251-r2';
const nodeBin = '/Users/tomermayara/.nvm/versions/node/v24.20.0/bin';
const git = (...args) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('rev-parse', 'origin/main') !== base) throw new Error('Pinned origin/main changed; manager must refresh selection.');
if (git('rev-parse', 'HEAD') !== expectedHead) throw new Error('Candidate changed; manager must review and refresh runner binding.');
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
const hashes = Object.fromEntries(tracked.map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]));
const isInput = path => /^(src|test|script|docker|migrations|patches)\//.test(path) || /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig.*|Dockerfile.*|compose\.yaml|\.npmrc|\.nvmrc)$/.test(path);
const dirtyPaths = git('diff', '--name-only', 'HEAD', '-z').split('\0').filter(Boolean);
const untrackedPaths = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
if ([...dirtyPaths, ...untrackedPaths].some(isInput)) throw new Error('Runtime/build inputs must match the committed candidate before launch.');
const inputPaths = tracked.filter(isInput);
const inputFingerprint = () => createHash('sha256').update(inputPaths.map(path => path + '\0' + createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')).join('\n')).digest('hex');
const originalFingerprint = inputFingerprint();
const runId = Date.now().toString();
const binding = JSON.stringify({ base, head: expectedHead, created: new Date().toISOString(), runId, dirtyPaths, untrackedPaths, inputFingerprint: originalFingerprint, inputPaths, files: hashes }, null, 2) + '\n';
writeFileSync(resolve(cache, `gated-inputs-${runId}.json`), binding, { flag: 'wx' });
writeFileSync(resolve(cache, 'gated-inputs.json'), binding);
const ledgerPath = resolve(cache, 'gate-ledger.json');
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : [];
const commonEnv = { ...process.env, PATH: [resolve(validation, 'bin'), nodeBin, process.env.PATH ?? ''].join(delimiter), LIGHTPANDA_BIN: resolve(root, '.cache/lightpanda/1.0.0/lightpanda'), DOCKER_CONTEXT: context, THERMUS_GATE_CACHE: cache };
for (const key of ['DOCKER_HOST', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH', 'BUILDX_BUILDER']) delete commonEnv[key];
const focused = ['acceptance/auth/hosted-membership-deletion', 'integration/auth/workos-connection', 'integration/auth/workos-google-onboarding', 'integration/auth/workos-provider-administration', 'integration/auth/workos-provider-directory', 'integration/auth/workos-provider-organizations', 'unit/auth-workos/workos-membership-reads', 'unit/auth-workos/workos-organizations-deletion', 'unit/auth-workos/workos-organizations-members', 'unit/auth-workos/workos-organizations-memberships', 'unit/auth-workos/workos-organizations'].map(path => `dist/test/${path}.test.js`);
const steps = [
  ['install', 'pnpm', ['install', '--frozen-lockfile']],
  ['runtime', 'pnpm', ['exec', 'node', '--version']],
  ['api-surface', 'pnpm', ['exec', 'node', 'script/pr-review/api-surface.ts', '--check']],
  ['focused-build', 'npm', ['run', 'build']],
  ['focused', 'node', ['--test', '--test-concurrency=1', ...focused]],
  ['ordinary', 'npm', ['test']],
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['portal', 'npm', ['run', 'build:user-portal']],
  ['hosted-live', 'node', ['/Users/tomermayara/.config/thermus/with-workos-staging.cjs', 'npm', 'run', 'test:hosted-live']],
  ['native-container', 'npm', ['run', 'test:container']],
  ['hosted-container', 'npm', ['run', 'test:container:hosted']],
  ['logging-postgres', 'npm', ['run', 'test:logging:postgres']],
  ['logging-collector', 'npm', ['run', 'test:logging:collector']],
  ['habit-hooks', 'habit-hooks', []],
  ['diff-check', 'git', ['diff', '--check']],
];
const from = process.argv[2] ?? steps[0][0];
const through = process.argv[3] ?? steps.at(-1)[0];
const start = steps.findIndex(([name]) => name === from);
const end = steps.findIndex(([name]) => name === through);
if (start < 0 || end < start) throw new Error('Unknown or reversed step range.');
for (const [name, command, args] of steps.slice(start, end + 1)) {
  if (inputFingerprint() !== originalFingerprint) throw new Error('Runtime/build inputs changed during validation. Stop for manager review.');
  const env = { ...commonEnv };
  if (name === 'ordinary') {
    const settings = parseEnv(readFileSync('/Users/tomermayara/git/Thermus/.env.local', 'utf8'));
    for (const key of ['AXIOM_API_KEY', 'AXOIM_ENDPOINT_URL']) {
      if (!settings[key]) throw new Error(`Missing configured ${key}; no value printed.`);
      env[key] = settings[key];
    }
    env.AXIOM_SYSTEM_LOG_TEST_DATA_SET = 'system-log-test';
  }
  const attempt = ledger.filter(row => row.name === name).length + 1;
  const log = `${name}-${attempt}.log`;
  const fd = openSync(resolve(cache, log), 'wx');
  const started = new Date().toISOString();
  console.log(`START ${name} attempt ${attempt}; ${log}`);
  let outcome;
  try {
    outcome = await new Promise(done => {
      const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', fd, fd] });
      child.once('error', error => done({ code: null, signal: null, spawnError: error.message }));
      child.once('close', (code, signal) => done({ code, signal }));
    });
  } finally { closeSync(fd); }
  if (name === 'runtime' && outcome.code === 0 && readFileSync(resolve(cache, log), 'utf8').trim() !== 'v24.20.0') outcome = { ...outcome, code: 1, validationError: 'Pinned runtime does not match v24.20.0.' };
  ledger.push({ name, attempt, runId, command, args, cwd: root, base, head: expectedHead, inputFingerprint: originalFingerprint, dockerContext: context, started, finished: new Date().toISOString(), log, ...outcome });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  console.log(`END ${name}: ${outcome.code ?? outcome.signal ?? outcome.spawnError}`);
  if (outcome.code !== 0) process.exit(outcome.code ?? 1);
}
