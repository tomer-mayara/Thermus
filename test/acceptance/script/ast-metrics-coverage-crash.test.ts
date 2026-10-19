import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { astMetricsCoverageScript, crashChildHelper } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

async function capturedCrash(t: import('node:test').TestContext) {
  const repository = GitRepository.create(t);
  repository.commit('Start', {
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"', 'test:unit': 'npm run build && node --test "dist/test/unit/**/*.test.js"' } }),
    'dist/src/sample.js': "import { writeFileSync } from 'node:fs'; export function earlier() { return 1; } export function later() { writeFileSync('later-ran', 'yes'); }\n",
    'dist/test/unit/crash.test.js': [
      "import assert from 'node:assert/strict'; import { spawn } from 'node:child_process'; import { once } from 'node:events'; import { existsSync } from 'node:fs'; import { test } from 'node:test'; import { setTimeout as delay } from 'node:timers/promises';",
      `import { crashChild } from ${JSON.stringify(crashChildHelper)};`,
      "test('sealed crash', async (t) => { const child = spawn(process.execPath, ['--input-type=module', '-e', \"import { earlier, later } from './dist/src/sample.js'; earlier(); setTimeout(later, 150); process.send('ready'); setInterval(() => {}, 1000);\"], { env: { ...process.env, THERMUS_COVERAGE_CRASH: '1' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); t.after(() => child.kill('SIGKILL')); await once(child, 'message'); await crashChild(child, async () => { await delay(250); assert.equal(existsSync('later-ran'), false); }); assert.equal(child.signalCode, 'SIGKILL'); });",
    ].join('\n'),
  });
  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  return { repository, report };
}

test('Given earlier product work and a queued later call, when the child seals coverage before SIGKILL, then earlier work is covered and later work never runs', { timeout: 15_000 }, async (t) => {
  const { repository, report } = await capturedCrash(t);
  const functions = report.files.find(({ path }: { path: string }) => path === 'src/sample.ts').functions;
  assert.equal(functions.find(({ name }: { name: string }) => name === 'earlier').coveredShare, 1);
  assert.equal(functions.find(({ name }: { name: string }) => name === 'later').coveredShare, 0);
  assert.equal(report.provenance.completionProtocol, 'normal-exit-or-sealed-or-loader-1');
  const [archive] = readdirSync(join(repository.root, 'ast-report/coverage-captures'));
  const imported = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--from', join('ast-report/coverage-captures', archive)] });
  assert.equal(imported.code, 0, imported.stderr);
  const retained = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  assert.equal(retained.provenance.captureId, report.provenance.captureId);
});

for (const corruption of ['stale nonce', 'missing receipt', 'stale receipt', 'missing flush', 'changed raw file', 'extra raw file'] as const) {
  test(`Given a real sealed crash capture with ${corruption}, when imported, then verification refuses publication`, { timeout: 15_000 }, async (t) => {
    const { repository } = await capturedCrash(t);
    const parent = join(repository.root, 'ast-report/coverage-captures');
    const folder = join(parent, readdirSync(parent)[0]);
    const markerName = readdirSync(folder).filter((name) => name.startsWith('process-')).find((name) => JSON.parse(readFileSync(join(folder, name), 'utf8')).state === 'sealed-before-crash');
    assert.ok(markerName !== undefined);
    const markerFile = join(folder, markerName);
    const marker = JSON.parse(readFileSync(markerFile, 'utf8'));
    const raw = join(folder, marker.files[0].name);
    if (corruption === 'stale nonce') writeFileSync(markerFile, JSON.stringify({ ...marker, nonce: '00000000-0000-0000-0000-000000000000' }));
    const receiptFile = join(folder, `seal-receipt-${marker.pid}-${marker.nonce}.json`);
    if (corruption === 'missing receipt') rmSync(receiptFile);
    if (corruption === 'stale receipt') {
      const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
      writeFileSync(receiptFile, JSON.stringify({ ...receipt, nonce: '00000000-0000-0000-0000-000000000000' }));
    }
    if (corruption === 'missing flush') rmSync(raw);
    if (corruption === 'changed raw file') writeFileSync(raw, `${readFileSync(raw, 'utf8')} `);
    if (corruption === 'extra raw file') copyFileSync(raw, join(folder, `coverage-${marker.pid}-1-0.json`));
    const good = readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8');
    const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--from', folder] });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /pre-crash coverage seal.*missing, stale, or changed/);
    assert.equal(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'), good);
  });
}

test('Given an active captured worker, when a pre-crash seal is requested, then the child refuses the seal and no verified report is written', { timeout: 15_000 }, async (t) => {
  const repository = GitRepository.create(t);
  const workerProgram = `import { Worker } from 'node:worker_threads'; import { once } from 'node:events'; const worker = new Worker(new URL('./dist/worker.js', import.meta.url), { execArgv: ['--import', ${JSON.stringify(new URL('coverage/lifecycle.ts', pathToFileURL(astMetricsCoverageScript)).href)}] }); await once(worker, 'message'); process.send('ready');`;
  repository.commit('Start', {
    'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"', 'test:unit': 'npm run build && node --test "dist/test/unit/**/*.test.js"' } }),
    'dist/src/sample.js': 'export function earlier() { return 1; }\n',
    'dist/worker.js': "import { parentPort } from 'node:worker_threads'; import { earlier } from './src/sample.js'; earlier(); parentPort.postMessage('ready'); setInterval(() => {}, 1000);\n",
    'dist/test/unit/worker.test.js': [
      "import assert from 'node:assert/strict'; import { spawn } from 'node:child_process'; import { once } from 'node:events'; import { test } from 'node:test';",
      `import { crashChild } from ${JSON.stringify(crashChildHelper)};`,
      `test('active worker rejects seal', async () => { const child = spawn(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(workerProgram)}], { env: { ...process.env, THERMUS_COVERAGE_CRASH: '1' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw Error('worker child exited before ready'); })]); await assert.rejects(crashChild(child), /workers cannot seal/); assert.equal(child.signalCode, 'SIGKILL'); });`,
    ].join('\n'),
  });
  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Incomplete captures are unverified/);
});

for (const ending of ['normal late work', 'late SIGKILL', 'late coverage stop'] as const) {
  test(`Given ${ending} in an exit listener installed after the capture preload, when capture finishes, then later flush evidence and the observed process outcome are required`, { timeout: 15_000 }, async (t) => {
    const repository = GitRepository.create(t);
    const atExit = ending === 'normal late work' ? 'late();' : ending === 'late SIGKILL' ? "process.kill(process.pid, 'SIGKILL');" : 'stopCoverage(); late();';
    const childProgram = `import { earlier, late } from './dist/src/sample.js'; import { stopCoverage } from 'node:v8'; earlier(); process.on('exit', () => { ${atExit} });`;
    repository.commit('Start', {
      'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node -e "process.exit(0)"', 'test:unit': 'npm run build && node --test "dist/test/unit/**/*.test.js"' } }),
      'dist/src/sample.js': 'export function earlier() { return 1; } export function late() { return 2; }\n',
      'dist/test/unit/exit.test.js': `import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import { test } from 'node:test'; test('exit work', () => { const child = spawnSync(process.execPath, ['--input-type=module', '-e', ${JSON.stringify(childProgram)}]); assert.equal(child.signal, ${ending === 'late SIGKILL' ? "'SIGKILL'" : 'null'}); });`,
    });
    const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });
    if (ending !== 'normal late work') {
      assert.equal(result.code, 1, result.stderr);
      assert.match(result.stderr, /Incomplete captures are unverified/);
      return;
    }
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
    const functions = report.files.find(({ path }: { path: string }) => path === 'src/sample.ts').functions;
    assert.equal(functions.find(({ name }: { name: string }) => name === 'late').coveredShare, 1);
  });
}
