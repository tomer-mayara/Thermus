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
  routes: { order: ['FIX', 'CLARIFICATION_NEEDED', 'ARCHITECT_REVIEW_NEEDED', 'SHIPPED'] },
  protected_paths: {
    policy: { route: 'CLARIFICATION_NEEDED', question: 'Who decides?', paths: ['AGENTS.md'] },
    contracts: { route: 'CLARIFICATION_NEEDED', question: 'What does a client see?', paths: ['src/index.ts'] },
  },
  read_paths: { route: 'ARCHITECT_REVIEW_NEEDED', paths: [], moved_by_stop_rule: [] },
  scopes: { production: ['src/**'], generated: [] },
  size: {
    production_lines_read_above: 400, total_lines_read_above: 1500,
    test_counts: { fewer_tests_than_base: 'ARCHITECT_REVIEW_NEEDED', more_skipped_or_todo_than_base: 'ARCHITECT_REVIEW_NEEDED' }, habit_hooks_snooze_non_empty: 'FIX',
  },
  public_surface: { contract_documents: [], external: ['src/index.ts'], between_packages: {}, documented: [] },
  dependency_graph: {
    counting: { unresolved_relative_import: 'FIX' }, triggers: Object.fromEntries(triggers.map((name) => [name, 'FIX'])),
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

test('Given a renamed file and a changed module that is both a protected contract and a surface module, when the result is made, then the contracts question comes once and the notes keep their order', () => {
  const result = resultOf(candidate, { base: rules, head: rules, path: 'r.yaml', notes: ['A note of the rules.'] }, undefined);
  const report = markdownOf(result);

  assert.equal(result.route, 'CLARIFICATION_NEEDED');
  assert.deepEqual(result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`), [
    'CLARIFICATION_NEEDED protected_paths.contracts: src/index.ts',
    'CLARIFICATION_NEEDED public_surface: src/index.ts',
  ]);
  assert.deepEqual(result.questions, [{ key: 'protected_paths.contracts', question: 'What does a client see?' }]);
  assert.deepEqual(result.lineCounts, { production: 4, productionLimit: 400, total: 4, totalLimit: 1500 });
  assert.deepEqual(result.notes, [
    'Uncommitted changes are not part of the candidate: the check reads the commit HEAD only.',
    'A note of the rules.',
    'The check does not compare declarations: compare the exported declarations of each module under "Surface differences" before and after the change, as the step "Declare or remove facts" says.',
    'The steps "Metrics" and "Decision" of the review route are manual: do them before Ready, as AGENTS.md says.',
  ]);
  assert.match(report, new RegExp(`^## Review route\\n\\nRoute: \`CLARIFICATION_NEEDED\`\\nCandidate: ${'b'.repeat(40)}\\nMerge base: ${'a'.repeat(40)}\\n\\n`));
  assert.match(report, /\nChanged paths:\n- R src\/a\/old\.ts -> src\/a\/a\.ts\n- M src\/index\.ts\n\n/);
  assert.match(report, /\nSurface differences:\n- src\/index\.ts\n\n/);
  assert.deepEqual(JSON.parse(jsonOf(result)), JSON.parse(JSON.stringify(result)));
});

test('Given snapshots in which the changed contract drops by five, when the result is made, then the MI reason is ARCHITECT_REVIEW_NEEDED among the other reasons and the report gives the MI section after the tests', () => {
  const snapshots = { base: new Map([['src/a/old.ts', 90], ['src/index.ts', 88]]), head: new Map([['src/a/a.ts', 89.5], ['src/index.ts', 82.5]]) };
  const result = resultOf({ ...candidate, snapshots }, { base: rules, head: rules, path: 'r.yaml', notes: [] }, undefined);

  assert.deepEqual(result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`), [
    'CLARIFICATION_NEEDED protected_paths.contracts: src/index.ts',
    'CLARIFICATION_NEEDED public_surface: src/index.ts',
    'ARCHITECT_REVIEW_NEEDED ratchet.maintainability_index.existing_file_drop_read_at: src/index.ts: 88 to 82.5',
  ]);
  assert.deepEqual(result.mi, ['changed: src/a/old.ts -> src/a/a.ts: 90 to 89.5', 'changed: src/index.ts: 88 to 82.5']);
  assert.match(markdownOf(result), /\nTests:\n(?:- .*\n){3}\nMI:\n- changed: src\/a\/old\.ts -> src\/a\/a\.ts: 90 to 89\.5\n- changed: src\/index\.ts: 88 to 82\.5\n\nCRAP:\n- not checked: give --crap\n\nMetrics:\n- not checked: give --process and --review\n\nFacts to declare:\n/);
});

test('Given CRAP rows of the renamed file, when the result is made, then the CRAP reason is FIX among the other reasons and the report gives the CRAP section after the MI section', () => {
  const crap = [
    { file: 'src/a/a.ts', function: 'grow', change: 'changed' as const, paths: 5 },
    { file: 'src/a/a.ts', function: 'small', change: 'new' as const, paths: 2 },
  ];
  const result = resultOf({ ...candidate, crap }, { base: rules, head: rules, path: 'r.yaml', notes: [] }, undefined);

  assert.equal(result.route, 'FIX');
  assert.deepEqual(result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`), [
    'FIX ratchet.crap.changed_legacy_function_at_or_above: src/a/a.ts: grow: [5, 30]',
    'CLARIFICATION_NEEDED protected_paths.contracts: src/index.ts',
    'CLARIFICATION_NEEDED public_surface: src/index.ts',
  ]);
  assert.deepEqual(result.crap, ['src/a/a.ts: small: pass from the bound [2, 6]']);
  assert.match(markdownOf(result), /\nMI:\n- not checked: give --base-snapshot and --head-snapshot\n\nCRAP:\n- src\/a\/a\.ts: small: pass from the bound \[2, 6\]\n\nMetrics:\n- not checked: give --process and --review\n\nFacts to declare:\n/);
});

test('Given metrics files with a failed CRAP stage and a high finding on the renamed file, when the result is made, then the metrics reasons join the others, the report gives the Metrics section after the CRAP section, and only the step "Decision" stays manual', () => {
  const metrics = {
    outcomes: [{ name: 'Delta', status: 'passed' }, { name: 'Review', status: 'goal miss' }, { name: 'CRAP', status: 'failed' }, { name: 'Architecture', status: 'passed' }],
    findings: [{ severity: 'high', file: 'src/a/a.ts', message: 'Maintainability too low: got 63 (min: 85)' }],
  } as const;
  const result = resultOf({ ...candidate, dirty: false, metrics }, { base: rules, head: rules, path: 'r.yaml', notes: [] }, undefined);

  assert.equal(result.route, 'FIX');
  assert.deepEqual(result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`), [
    'FIX required_checks: CRAP failed',
    'CLARIFICATION_NEEDED protected_paths.contracts: src/index.ts',
    'CLARIFICATION_NEEDED public_surface: src/index.ts',
    'ARCHITECT_REVIEW_NEEDED ratchet.review_findings: src/a/a.ts: Maintainability too low: got 63 (min: 85)',
  ]);
  assert.deepEqual(result.metrics, ['Delta: passed', 'Review: goal miss', 'CRAP: failed', 'Architecture: passed', '0 findings on unchanged files, reason unchanged by this PR']);
  assert.equal(result.notes.at(-1), 'The step "Decision" of the review route is manual: do it before Ready, as AGENTS.md says.');
  assert.match(markdownOf(result), /\nCRAP:\n- not checked: give --crap\n\nMetrics:\n- Delta: passed\n- Review: goal miss\n- CRAP: failed\n- Architecture: passed\n- 0 findings on unchanged files, reason unchanged by this PR\n\nFacts to declare:\n/);
});
