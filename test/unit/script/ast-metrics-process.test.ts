import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { astMetricsProcessScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import type { ProcessOperations } from '../../../script/code-quality/process/types.ts';

const { processCommandOf } = await import(new URL('process/command-line.ts', pathToFileURL(astMetricsProcessScript)).href) as typeof import('../../../script/code-quality/process/command-line.ts');
const { runProcess } = await import(new URL('process/run.ts', pathToFileURL(astMetricsProcessScript)).href) as typeof import('../../../script/code-quality/process/run.ts');
const { processReportOf } = await import(new URL('process/report.ts', pathToFileURL(astMetricsProcessScript)).href) as typeof import('../../../script/code-quality/process/report.ts');

function scenario(overrides: Partial<ProcessOperations> = {}) {
  const calls: string[] = [];
  const operations: ProcessOperations = {
    delta: () => { calls.push('delta'); return { text: 'Delta evidence.', passed: true }; },
    review: () => { calls.push('review'); return { text: 'Review evidence.', passed: true }; },
    coverage: () => { calls.push('coverage'); return { notice: 'Coverage reused.', file: 'coverage.json', required: true }; },
    crap: async () => { calls.push('crap'); return { text: 'CRAP evidence.', passed: true }; },
    architecture: async () => {
      calls.push('architecture');
      return { text: 'Architecture evidence.', publish: () => { calls.push('record'); return 'Recorded architecture evidence.'; } };
    },
    ...overrides,
  };
  return { calls, operations };
}

test('completed stages run in order and publish only after all analysis completes', async () => {
  const { calls, operations } = scenario();
  const report = await runProcess(operations);
  assert.deepEqual(calls, ['delta', 'review', 'coverage', 'crap', 'architecture', 'record']);
  assert.equal(report.passed, true);
  assert.deepEqual(report.outcomes, [
    { name: 'Delta', status: 'passed', text: 'Delta evidence.' },
    { name: 'Review', status: 'passed', text: 'Review evidence.' },
    { name: 'CRAP', status: 'passed', text: 'Coverage reused.\n\nCRAP evidence.' },
    { name: 'Architecture', status: 'passed', text: 'Recorded architecture evidence.' },
  ]);
  assert.equal(report.text, '# Code quality process\n\n## Delta\n\nStatus: passed.\n\n```text\nDelta evidence.\n```\n\n## Review\n\nStatus: passed.\n\nReview evidence.\n\n## CRAP\n\nStatus: passed.\n\nCoverage reused.\n\nCRAP evidence.\n\n## Architecture\n\nStatus: passed.\n\nRecorded architecture evidence.\n');
});

test('the Delta text fence preserves aligned rows and other Markdown keeps its leading indentation', () => {
  const report = processReportOf([
    { name: 'Delta', status: 'passed', text: '   50  src/a.ts\n   90  src/b.ts\n' },
    { name: 'Review', status: 'passed', text: '  - review finding\n\n' },
    { name: 'CRAP', status: 'passed', text: '    CRAP evidence\n' },
    { name: 'Architecture', status: 'passed', text: '```mermaid\n  flowchart LR\n```\n' },
  ]);
  assert.equal(report, '# Code quality process\n\n## Delta\n\nStatus: passed.\n\n```text\n   50  src/a.ts\n   90  src/b.ts\n```\n\n## Review\n\nStatus: passed.\n\n  - review finding\n\n\n## CRAP\n\nStatus: passed.\n\n    CRAP evidence\n\n## Architecture\n\nStatus: passed.\n\n```mermaid\n  flowchart LR\n```\n');
});

test('completed goal misses continue through all evidence and may record', async () => {
  const { calls, operations } = scenario({ delta: () => ({ text: 'Below 85.', passed: false }), review: () => ({ text: 'High finding.', passed: false }), crap: async () => ({ text: 'Above target.', passed: false }) });
  const report = await runProcess(operations);
  assert.equal(report.passed, false);
  assert.match(report.text, /Status: goal miss\.\n\n```text\nBelow 85\./);
  assert.match(report.text, /Above target\./);
  assert.deepEqual(report.outcomes, [
    { name: 'Delta', status: 'goal miss', text: 'Below 85.' },
    { name: 'Review', status: 'goal miss', text: 'High finding.' },
    { name: 'CRAP', status: 'goal miss', text: 'Coverage reused.\n\nAbove target.' },
    { name: 'Architecture', status: 'passed', text: 'Recorded architecture evidence.' },
  ]);
  assert.equal(calls.at(-1), 'record');
});

for (const [stage, failureIndex] of [['delta', 0], ['review', 1], ['coverage', 2], ['crap', 2], ['architecture', 3]] as const) {
  test(`${stage} operational failure keeps partial evidence and does not record`, async () => {
    const { calls, operations } = scenario({ [stage]: () => { throw new Error('Tool failed.'); } });
    const report = await runProcess(operations);
    assert.equal(report.passed, false);
    assert.match(report.text, stage === 'delta' ? /Status: failed\.\n\n```text\nTool failed\./ : /Status: failed\.\n\nTool failed\./);
    const completed = [
      { name: 'Delta', status: 'passed', text: 'Delta evidence.' },
      { name: 'Review', status: 'passed', text: 'Review evidence.' },
      { name: 'CRAP', status: 'passed', text: 'Coverage reused.\n\nCRAP evidence.' },
    ];
    const names = ['Delta', 'Review', 'CRAP', 'Architecture'];
    assert.deepEqual(report.outcomes, names.map((name, index) => index < failureIndex ? completed[index] : { name, status: index === failureIndex ? 'failed' : 'unavailable', text: index === failureIndex ? 'Tool failed.' : 'A prerequisite failed. This stage did not run.' }));
    assert.equal(calls.includes('record'), false);
    assert.equal([...report.text.matchAll(/^## /gm)].length, 4);
  });
}

test('missing required coverage withholds CRAP and history but keeps structure', async () => {
  const { calls, operations } = scenario({ coverage: () => ({ required: true, notice: 'Coverage is stale.' }) });
  const report = await runProcess(operations);
  assert.equal(report.passed, false);
  assert.match(report.text, /Required CRAP goals are unresolved/);
  assert.match(report.text, /Architecture evidence/);
  assert.deepEqual(calls, ['delta', 'review', 'architecture']);
  assert.deepEqual(report.outcomes, [
    { name: 'Delta', status: 'passed', text: 'Delta evidence.' },
    { name: 'Review', status: 'passed', text: 'Review evidence.' },
    { name: 'CRAP', status: 'unavailable', text: 'Coverage is stale.\n\nRequired CRAP goals are unresolved. No assessment was made.' },
    { name: 'Architecture', status: 'passed', text: 'Architecture evidence.' },
  ]);
});

test('empty selection needs no coverage and can record structural history', async () => {
  const { calls, operations } = scenario({ coverage: () => ({ required: false, notice: 'No coverage.' }), crap: async () => ({ passed: true, text: 'No production files to assess.' }) });
  const report = await runProcess(operations);
  assert.equal(report.passed, true);
  assert.equal(calls.at(-1), 'record');
  assert.deepEqual(report.outcomes, [
    { name: 'Delta', status: 'passed', text: 'Delta evidence.' },
    { name: 'Review', status: 'passed', text: 'Review evidence.' },
    { name: 'CRAP', status: 'passed', text: 'No coverage.\n\nNo production files to assess.' },
    { name: 'Architecture', status: 'passed', text: 'Recorded architecture evidence.' },
  ]);
});

test('recording failure keeps the completed architecture evidence and fails', async () => {
  const { operations } = scenario({ architecture: async () => ({ text: 'Complete graph and legend.', publish: () => { throw new Error('Cannot publish.'); } }) });
  const report = await runProcess(operations);
  assert.equal(report.passed, false);
  assert.match(report.text, /Complete graph and legend\.\n\nHistory recording failed: Cannot publish\./);
  assert.deepEqual(report.outcomes, [
    { name: 'Delta', status: 'passed', text: 'Delta evidence.' },
    { name: 'Review', status: 'passed', text: 'Review evidence.' },
    { name: 'CRAP', status: 'passed', text: 'Coverage reused.\n\nCRAP evidence.' },
    { name: 'Architecture', status: 'failed', text: 'Complete graph and legend.\n\nHistory recording failed: Cannot publish.' },
  ]);
});

test('options preserve custom paths, base, collection choice, and tool override', () => {
  assert.deepEqual(processCommandOf(['--base', 'release', '--coverage', '../coverage.json', '--out', '../report.md', '--json', '../process.json', '--allow-tool-version']), {
    base: 'release', coverage: '../coverage.json', out: '../report.md', json: '../process.json', allowToolVersion: true, collectCoverage: false, skipCoverage: false,
  });
  assert.equal('collectCoverage' in processCommandOf(['--collect-coverage']), true);
});

for (const args of [
  ['--collect-coverage', '--skip-coverage'], ['--coverage', 'x', '--skip-coverage'], ['--coverage', 'x', '--collect-coverage'],
  ['--base='], ['--base=-bad'], ['--coverage='], ['--out='], ['--json='], ['--unknown'], ['unexpected'],
]) {
  test(`invalid options run no process: ${args.join(' ')}`, () => assert.throws(() => processCommandOf(args)));
}

test('help works outside a repository without tools and states coverage policy', async (t) => {
  const result = await runScript(t, astMetricsProcessScript, { cwd: tmpdir(), args: ['--help'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  for (const text of ['--collect-coverage', '--skip-coverage', 'already selected', 'no policy exception', 'Completed goal misses', '--json FILE']) assert.ok(result.stdout.includes(text), text);
});

test('conflicting CLI options fail before repository or tool access', async (t) => {
  const result = await runScript(t, astMetricsProcessScript, { cwd: tmpdir(), args: ['--collect-coverage', '--coverage', 'report.json'], env: { PATH: '' } });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Give only one of --coverage, --collect-coverage, or --skip-coverage/);
});
