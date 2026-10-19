import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsCrapScript);
const { measuredFunctionsOf } = await import(new URL('crap/metrics.ts', root).href) as typeof import('../../../script/code-quality/crap/metrics.ts');
const { sourceFileOf } = await import(new URL('crap/source-evidence.ts', root).href) as typeof import('../../../script/code-quality/crap/source-evidence.ts');
const path = 'src/styles.ts';
const constantMetrics = {
  path,
  language: 'TypeScript',
  cyclomatic_complexity: 0,
  lines_of_code: { lines_of_code: 56, logical_lines: 1, comment_lines: 0 },
  risk_score: 0,
  volume: { loc: 56, lloc: 1, cloc: 0 },
  coupling: { afferent: 1, efferent: 0, instability: 0 },
};

test('Given a constant module and pinned metrics without functions, when CRAP reads the measurement, then it accepts no function rows', () => {
  const source = sourceFileOf(path, 'export const styles = `body { margin: 0; }`;');
  assert.equal(source.functions?.length, 0);
  assert.deepEqual(measuredFunctionsOf(path, JSON.stringify(constantMetrics), source.functions?.length ?? -1), []);
});

test('Given source function declarations and omitted metrics, when CRAP reads the measurement, then the goals remain unresolved', () => {
  const source = sourceFileOf(path, 'export const styles = () => "body {}";');
  assert.equal(source.functions?.length, 1);
  assert.throws(() => measuredFunctionsOf(path, JSON.stringify(constantMetrics), source.functions?.length ?? -1), /invalid function metrics|omitted source declarations/u);
});

for (const [name, metrics] of [
  ['empty answer', {}],
  ['missing complexity', { ...constantMetrics, cyclomatic_complexity: undefined }],
  ['nonzero complexity', { ...constantMetrics, cyclomatic_complexity: 1 }],
  ['string complexity', { ...constantMetrics, cyclomatic_complexity: '0' }],
  ['nonzero risk', { ...constantMetrics, risk_score: 1 }],
  ['missing risk', { ...constantMetrics, risk_score: undefined }],
  ['different file', { ...constantMetrics, path: 'src/other.ts' }],
  ['missing line counts', { ...constantMetrics, lines_of_code: undefined }],
  ['invalid line counts', { ...constantMetrics, lines_of_code: { lines_of_code: -1, logical_lines: 1, comment_lines: 0 } }],
  ['null functions', { ...constantMetrics, functions: null }],
  ['object functions', { ...constantMetrics, functions: {} }],
] as const) {
  test(`Given ${name}, when CRAP reads omitted or malformed function metrics, then it rejects the answer`, () => {
    assert.throws(() => measuredFunctionsOf(path, JSON.stringify(metrics), 0), /invalid function metrics/u);
  });
}

test('Given explicit function metrics, when CRAP reads the measurement, then it keeps function validation and source completeness', () => {
  assert.deepEqual(measuredFunctionsOf(path, '{"functions":[]}', 0), []);
  assert.deepEqual(measuredFunctionsOf(path, '{"functions":[{"name":"styles","cyclomatic_complexity":1}]}', 1), [
    { name: 'styles', paths: 1, maintainability: undefined, loc: 0 },
  ]);
  assert.throws(() => measuredFunctionsOf(path, '{"functions":[]}', 1), /omitted source declarations/u);
  assert.throws(() => measuredFunctionsOf(path, '{"functions":[{"cyclomatic_complexity":-1}]}', 1), /invalid function metrics/u);
});
