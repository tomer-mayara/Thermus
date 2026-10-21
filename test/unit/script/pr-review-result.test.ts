import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(prReviewCheckScript);
const { resultOf } = await import(new URL('result.ts', root).href) as typeof import('../../../script/pr-review/result.ts');
const { jsonOf, markdownOf } = await import(new URL('report.ts', root).href) as typeof import('../../../script/pr-review/report.ts');
const { rulesOf } = await import(new URL('rules.ts', root).href) as typeof import('../../../script/pr-review/rules.ts');

const triggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];
const rules = rulesOf(stringify({
  version: 2,
  tiers: { order: ['T2', 'T1', 'T0'], names: { T0: 'T0 Auto merge', T1: 'T1 Team review', T2: 'T2 Need architect' } },
    metrics: { process_paths: ['src/**', 'script/code-quality/**', '.ast-metrics.yaml', '.ast-metrics-baseline.yaml', '.code-quality-exceptions.yaml'] },
  protected_paths: {
    policy: { tier: 'T1', question: 'Who decides?', paths: ['AGENTS.md'] },
    contracts: { tier: 'T1', question: 'What does a client see?', paths: ['src/index.ts'] },
  },
  read_paths: { tier: 'T1', paths: [], moved_by_stop_rule: [] },
  scopes: { production: ['src/**'], generated: [] },
  size: {
    production_lines_read_above: 400, total_lines_read_above: 1500,
    test_counts: { fewer_tests_than_base: 'T1', more_skipped_or_todo_than_base: 'T1' }, habit_hooks_snooze_non_empty: 'blocked',
  },
  public_surface: { contract_documents: [], external: ['src/index.ts'], between_packages: {}, documented: [] },
  dependency_graph: {
    counting: { unresolved_relative_import: 'blocked' }, triggers: Object.fromEntries(triggers.map((name) => [name, 'blocked'])),
    packages: ['a', 'composition'], allowed_edges: [{ from: 'composition', to: 'a', kind: 'runtime' }], forbidden_edges: [], known_cycles: [],
    allowed_external_imports: {}, allowed_node_builtins: {},
  },
  ratchet: { maintainability_index: { new_file_below: 85, existing_file_drop_read_at: 5 }, crap: { new_function_above: 15, changed_legacy_function_at_or_above: 30 } },
}), 'The rules file r.yaml at HEAD');

const candidate = {
  head: 'b'.repeat(40),
  mergeBase: 'a'.repeat(40),
  changes: [{ status: 'R', oldPath: 'src/a/old.ts', path: 'src/a/a.ts' }, { status: 'M', path: 'src/index.ts' }],
  numstat: [{ added: 1, deleted: 0, paths: ['src/a/old.ts', 'src/a/a.ts'] }, { added: 2, deleted: 1, paths: ['src/index.ts'] }],
  productionNumstat: [{ added: 1, deleted: 0, paths: ['src/a/a.ts'] }, { added: 2, deleted: 1, paths: ['src/index.ts'] }],
  testDiff: '',
  sourcePaths: ['src/a/a.ts', 'src/index.ts'],
  sources: new Map([['src/a/a.ts', 'export const a = 1;\n'], ['src/index.ts', "import { a } from './a/a.ts';\n\nexport const b = a;\n"]]),
  snooze: '[]',
  today: '2026-10-21',
  dirty: true,
};

const complete = {
  ...candidate, dirty: false,
  impact: {
    version: 1 as const, base: candidate.mergeBase, head: candidate.head,
    classification: { container: false, external: false, contract: false, deployment: false, crossCutting: false, component: false, internalInterface: false, sensitiveBehavior: false, dependencyRisk: false, policy: false, uncertain: false },
    architecture: { modelUpdated: false, summary: 'Current views still match.', views: ['Runtime'], evidence: ['src/index.ts'] },
  },
  snapshots: { base: new Map([['src/a/old.ts', 90], ['src/index.ts', 90]]), head: new Map([['src/a/a.ts', 90], ['src/index.ts', 90]]) },
  crap: [],
  metrics: { outcomes: ['Delta', 'Review', 'CRAP', 'Architecture'].map((name) => ({ name, status: 'passed' })), findings: [] } as import('../../../script/pr-review/metrics-files.ts').MetricsFiles,
};
const loaded = { base: rules, head: rules, path: 'r.yaml', notes: [] };

test('Given a contract candidate with complete local evidence, when the report is made, then each review reason is retained and the contracts question appears once', () => {
  const result = resultOf(complete, loaded, undefined);
  assert.equal(result.tier, 'T1');
  assert.equal(result.tierName, 'T1 Team review');
  assert.equal(result.eligibility, 'eligible');
  assert.deepEqual(result.reasons.map((reason) => reason.key), ['protected_paths.contracts', 'public_surface']);
  assert.deepEqual(result.questions, [{ key: 'protected_paths.contracts', question: 'What does a client see?' }]);
  assert.deepEqual(result.lineCounts, { production: 4, productionLimit: 400, total: 4, totalLimit: 1500 });
  const report = markdownOf(result);
  assert.match(report, /^## Review tier\n\nTier: `T1 Team review`\nLocal eligibility: `eligible`/);
  assert.match(report, /Changed paths:\n- R src\/a\/old\.ts -> src\/a\/a\.ts/);
  assert.match(report, /Local eligibility is preliminary/);
  assert.deepEqual(JSON.parse(jsonOf(result)), JSON.parse(JSON.stringify(result)));
});

test('Given an MI regression and an architectural change, when the result is made, then the T1 quality finding does not replace T2 Need architect', () => {
  const snapshots = { base: complete.snapshots.base, head: new Map([['src/a/a.ts', 90], ['src/index.ts', 82.5]]) };
  const impact = { ...complete.impact, classification: { ...complete.impact.classification, contract: true } };
  const result = resultOf({ ...complete, snapshots, impact }, loaded, undefined);
  assert.equal(result.tier, 'T2');
  assert.ok(result.reasons.some((reason) => reason.tier === 'T1' && reason.key === 'ratchet.maintainability_index.existing_file_drop_read_at'));
  assert.ok(result.reasons.some((reason) => reason.tier === 'T2' && reason.key === 'impact.contract'));
});

test('Given a CRAP failure and an architectural change, when the result is made, then the failure blocks merge and the tier remains T2 Need architect', () => {
  const crap = [{ file: 'src/a/a.ts', function: 'grow', change: 'changed' as const, paths: 5 }];
  const impact = { ...complete.impact, classification: { ...complete.impact.classification, contract: true } };
  const result = resultOf({ ...complete, crap, impact }, loaded, undefined);
  assert.equal(result.tier, 'T2');
  assert.equal(result.eligibility, 'blocked');
  assert.deepEqual(result.blockers.map((reason) => reason.key), ['ratchet.crap.changed_legacy_function_at_or_above']);
});

test('Given a failed metrics stage and a kept high finding, when the result is made, then the stage blocks and the finding still needs T1 Team review', () => {
  const metrics = {
    outcomes: [{ name: 'Delta', status: 'passed' }, { name: 'Review', status: 'goal miss' }, { name: 'CRAP', status: 'failed' }, { name: 'Architecture', status: 'passed' }],
    findings: [{ severity: 'high', file: 'src/a/a.ts', message: 'Maintainability too low: got 63 (min: 85)' }],
  } as const;
  const result = resultOf({ ...complete, metrics }, loaded, undefined);
  assert.equal(result.tier, 'T1');
  assert.equal(result.eligibility, 'blocked');
  assert.ok(result.blockers.some((reason) => reason.key === 'required_checks'));
  assert.ok(result.reasons.some((reason) => reason.tier === 'T1' && reason.key === 'ratchet.review_findings'));
  const report = markdownOf(result);
  assert.ok(report.indexOf('MI:') < report.indexOf('CRAP:'));
  assert.ok(report.indexOf('CRAP:') < report.indexOf('Metrics:'));
  assert.match(report, /CRAP: failed/);
});
