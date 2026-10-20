import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { coverageReport } from './fixtures/ast-metrics-architecture-repository-goldens.ts';
import { documentProcessMarkdown, processFixture, recordsIn } from './fixtures/ast-metrics-process.ts';
import { metricsReportOf } from './fixtures/ast-metrics-report.ts';
import { verifiedCoverageFor } from './fixtures/ast-metrics-verified-coverage.ts';

test('Given a source goal miss, a custom base, and a version override, when the process completes, then all stages keep evidence and a verified history record can be added', { timeout: 20_000 }, async (t) => {
  const { repository, doubles, run } = processFixture(t, { metrics: metricsReportOf({ 'src/auth/session.ts': 50 }), version: '0.99.0' });
  repository.commit('Add the release function', { 'src/auth/session.ts': 'export function openSession() { return 1; }\n' });
  repository.git('branch', 'release');
  repository.commit('Remove the function on main', { 'src/auth/session.ts': 'export const value = 10;\n' });
  repository.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  repository.write({ 'src/auth/session.ts': 'export function openSession() { return 2; }\n' });
  repository.write({ 'ast-report/coverage.json': JSON.stringify(verifiedCoverageFor(repository, coverageReport)) });

  const result = await run(['--base', 'release', '--allow-tool-version']);

  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stdout, /## Delta\n\nStatus: goal miss\./);
  assert.match(result.stdout, /## CRAP\n\nStatus: goal miss\./);
  assert.match(result.stdout, /\| src\/auth\/session.ts \| openSession \| changed \|/);
  assert.match(result.stdout, /## Architecture\n\nStatus: passed\./);
  assert.equal(readFileSync(join(repository.root, 'ast-report/process.md'), 'utf8'), result.stdout);
  assert.equal(recordsIn(repository).length, 1);
  const commands = doubles.cli.calls().map(({ argv }) => argv);
  assert.equal(commands.filter((args) => args[0] === 'mcp').length, 3);
  assert.ok(commands.some((args) => args.includes('--compare-with=release')));
  assert.ok(commands.some((args) => args[0] === 'review' && args.includes('release')));
});

test('Given a document-only candidate and an output directory, when saving fails and a file retry succeeds, then complete output and the base record remain', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  const outputDirectory = join(repository.root, 'ast-report/output');
  mkdirSync(outputDirectory, { recursive: true });

  const failed = await run(['--out', outputDirectory]);

  assert.equal(failed.code, 1);
  assert.match(failed.stderr, /^ast-metrics-process: /m);
  assert.equal(failed.stdout, documentProcessMarkdown(repository));
  assert.deepEqual([...failed.stdout.matchAll(/^## (Delta|Review|CRAP|Architecture)\n\nStatus: (\w+)\./gm)].map((match) => [match[1], match[2]]), [
    ['Delta', 'passed'], ['Review', 'passed'], ['CRAP', 'passed'], ['Architecture', 'passed'],
  ]);
  const baseCommit = repository.git('rev-parse', 'origin/main').trim();
  const baseDate = repository.git('show', '-s', '--format=%cI', 'origin/main').trim();
  const recordName = `${baseDate.slice(0, 10)}-${baseCommit.slice(0, 8)}.json`;
  const recordDirectory = join(repository.root, 'docs/metrics');
  assert.deepEqual(readdirSync(recordDirectory).filter((name) => name.endsWith('.json')), [recordName]);
  const record = recordsIn(repository)[0];
  assert.equal(record.version, 1);
  assert.equal(record.commit, baseCommit);
  assert.equal(record.date, baseDate);
  assert.equal(record.functionsOver30, undefined);
  assert.equal(record.crap, undefined);
  const recordBytes = readFileSync(join(recordDirectory, recordName));

  const retry = await run(['--out', 'ast-report/retry.md']);

  assert.equal(retry.code, 0, retry.stderr);
  assert.equal(retry.stdout, failed.stdout);
  assert.equal(readFileSync(join(repository.root, 'ast-report/retry.md'), 'utf8'), retry.stdout);
  assert.deepEqual(readdirSync(recordDirectory).filter((name) => name.endsWith('.json')), [recordName]);
  assert.deepEqual(readFileSync(join(recordDirectory, recordName)), recordBytes);
});

test('Given an ambiguous review exit 1 with no completed JSON, when the process runs, then it saves a failed review and unavailable dependent sections without history', { timeout: 20_000 }, async (t) => {
  const { repository, doubles, run } = processFixture(t, { reviewExitCode: 1, reviewSkipJson: true });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stdout, /## Review\n\nStatus: failed\./);
  assert.match(result.stdout, /## CRAP\n\nStatus: unavailable\./);
  assert.equal(recordsIn(repository).length, 0);
  assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'mcp').length, 0);
  assert.equal(readFileSync(join(repository.root, 'ast-report/process.md'), 'utf8'), result.stdout);
});

test('Given malformed architecture analysis, when the process runs, then it keeps earlier sections and adds no history record', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({ 'ast-metrics-fake-report.json': '{}' });
  const result = await run();
  assert.equal(result.code, 1);
  assert.match(result.stdout, /## Architecture\n\nStatus: failed\./);
  assert.equal(recordsIn(repository).length, 0);
});

test('Given a missing main ancestry prerequisite, when recording fails after rendering, then the saved partial report keeps the complete drawing and the failure', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.git('update-ref', '-d', 'refs/remotes/origin/main');
  const result = await run(['--base', 'main']);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /## Architecture\n\nStatus: failed\./);
  assert.match(result.stdout, /History recording failed/);
  assert.match(result.stdout, /```mermaid/);
  assert.equal(readFileSync(join(repository.root, 'ast-report/process.md'), 'utf8'), result.stdout);
});
