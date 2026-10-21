import type { GoalFunction } from '../../../script/code-quality/crap/types.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { crapReportOf } = await import(new URL('crap/report.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/crap/report.ts');

test('Given new, changed, unchanged and unmeasured functions, when goals are assessed, then the report gives required work and unresolved counts', () => {
  const rows: GoalFunction[] = [
    { file: 'src/a.ts', name: 'changed', paths: 20, share: 0.5, crap: 70, change: 'changed', identity: '1' },
    { file: 'src/a.ts', name: 'fresh', paths: 4, share: 0, crap: 20, change: 'new', identity: '2' },
    { file: 'src/a.ts', name: 'old', paths: 35, share: 1, crap: 35, change: 'unchanged', identity: '3' },
    { file: 'src/a.ts', name: 'unknown', paths: 8, share: undefined, crap: 8, change: 'unknown', identity: '4' },
  ];
  const report = crapReportOf(rows, { limit: 30, target: 15 });
  assert.equal(report.passed, false);
  assert.equal(report.text, [
    '## CRAP goals', '',
    'Goals: CRAP < 30; new functions also CRAP ≤ 15.', '',
    '| File | Function | Change | Paths | Coverage | CRAP | To do |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| src/a.ts | changed | changed | 20 | 50% | 70.0 | cover ≥ 71% |',
    '| src/a.ts | old | unchanged | 35 | 100% | 35.0 | split; unchanged by this PR |',
    '| src/a.ts | fresh | new | 4 | 0% | 20.0 | ok; for 15: cover ≥ 12%; required new target missed |',
    '| src/a.ts | unknown | unknown | 8 | unknown | ≥ 8 | no coverage data; identity unknown: cannot classify the new-function target |',
    '',
    'Known limit violations: 2. Measured target misses: 3. Unmeasured functions: 1. Required functions with unknown assessment or identity: 1.',
    'Unmeasured values are lower bounds; the known violation count is not an exact total.',
  ].join('\n'));
});

test('Given tied scores and duplicate names, when rows are reported, then file, name and source identity give a stable order', () => {
  const entry: Omit<GoalFunction, 'identity'> = { file: 'src/a.ts', name: 'f', paths: 4, share: 0, crap: 20, change: 'changed' };
  const rows: GoalFunction[] = [
    { ...entry, file: 'src/z.ts', identity: '1' },
    { ...entry, name: 'z', identity: '1' },
    { ...entry, identity: '2', change: 'unchanged' },
    { ...entry, identity: '1' },
    { ...entry, name: 'bound', paths: 30, crap: 30, share: undefined, identity: '1' },
  ];
  const report = crapReportOf(rows, { limit: 30, target: 15 });
  const body = report.text.split('\n').filter((line: string) => line.startsWith('| src/'));
  assert.match(body[0], /bound.*≥ 30.*split; no coverage data/u);
  assert.match(body[1], /src\/a\.ts \| f \| changed/u);
  assert.match(body[2], /src\/a\.ts \| f \| unchanged/u);
  assert.match(body[3], /src\/a\.ts \| z/u);
  assert.match(body[4], /src\/z\.ts/u);
  assert.match(report.text, /Known limit violations: 1\. Measured target misses: 4\. Unmeasured functions: 1\. Required functions with unknown assessment or identity: 1\./u);
});

test('Given unknown shares, when bounds are assessed, then only an impossible applicable goal says split', () => {
  const rows: GoalFunction[] = [
    { file: 'src/a.ts', name: 'new20', paths: 20, crap: 20, share: undefined, change: 'new', identity: '1' },
    { file: 'src/a.ts', name: 'new15', paths: 15, crap: 15, share: undefined, change: 'new', identity: '2' },
    { file: 'src/a.ts', name: 'changed20', paths: 20, crap: 20, share: undefined, change: 'changed', identity: '3' },
  ];
  const report = crapReportOf(rows, { limit: 30, target: 15 });
  assert.match(report.text, /new20.*split; no coverage data/u);
  assert.match(report.text, /new15.*\| no coverage data \|/u);
  assert.match(report.text, /changed20.*\| no coverage data \|/u);
  assert.equal(report.passed, false);
});

test('Given a custom strict limit and inclusive target, when exact scores meet each boundary, then only the strict equality fails', () => {
  const entry: GoalFunction = { file: 'src/a.ts', name: 'f', paths: 4, share: 0, crap: 20, change: 'new', identity: '1' };
  assert.equal(crapReportOf([entry], { limit: 21, target: 20 }).passed, true);
  const report = crapReportOf([entry], { limit: 20, target: 10 });
  assert.equal(report.passed, false);
  assert.match(report.text, /cover ≥ 1%; required new target missed/u);
});
