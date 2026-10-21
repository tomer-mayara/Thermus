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
  routes: { order: ['FIX', 'ASK', 'READ', 'SHOW', 'SHIP'] },
  protected_paths: {
    policy: { route: 'ASK', question: 'Who decides?', paths: ['AGENTS.md'] },
    contracts: { route: 'ASK', question: 'What does a client see?', paths: ['src/index.ts'] },
  },
  read_paths: { route: 'READ', paths: [], moved_by_stop_rule: [] },
  scopes: { production: ['src/**'], executable: ['src/**'], generated: [] },
  size: {
    production_lines_read_above: 400, total_lines_read_above: 1500,
    test_counts: { fewer_tests_than_base: 'READ', more_skipped_or_todo_than_base: 'READ' }, habit_hooks_snooze_non_empty: 'FIX',
  },
  public_surface: { contract_documents: [], external: ['src/index.ts'], between_packages: {}, documented: [] },
  dependency_graph: {
    counting: { unresolved_relative_import: 'FIX' }, triggers: Object.fromEntries(triggers.map((name) => [name, 'FIX'])),
    packages: ['a', 'composition'], allowed_edges: [{ from: 'composition', to: 'a', kind: 'runtime' }], forbidden_edges: [], known_cycles: [],
    allowed_external_imports: {}, allowed_node_builtins: {},
  },
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
  dirty: true,
};

test('Given a renamed file and a changed module that is both a protected contract and a surface module, when the result is made, then the contracts question comes once and the notes keep their order', () => {
  const result = resultOf(candidate, { base: rules, head: rules, path: 'r.yaml', notes: ['A note of the rules.'] }, undefined);
  const report = markdownOf(result);

  assert.equal(result.route, 'ASK');
  assert.deepEqual(result.reasons.map((reason) => `${reason.route} ${reason.key}: ${reason.fact}`), [
    'ASK protected_paths.contracts: src/index.ts',
    'ASK public_surface: src/index.ts',
    'SHOW scopes.executable: 2 changed files',
  ]);
  assert.deepEqual(result.questions, [{ key: 'protected_paths.contracts', question: 'What does a client see?' }]);
  assert.deepEqual(result.lineCounts, { production: 4, productionLimit: 400, total: 4, totalLimit: 1500 });
  assert.deepEqual(result.notes, [
    'Uncommitted changes are not part of the candidate: the check reads the commit HEAD only.',
    'A note of the rules.',
    'The check does not compare declarations: compare the exported declarations of each module under "Surface differences" before and after the change, as the step "Declare or remove facts" says.',
    'The steps "Metrics" and "Decision" of the review route are manual: do them before Ready, as AGENTS.md says.',
  ]);
  assert.match(report, new RegExp(`^## Review route\\n\\nRoute: \`ASK\`\\nCandidate: ${'b'.repeat(40)}\\nMerge base: ${'a'.repeat(40)}\\n\\n`));
  assert.match(report, /\nChanged paths:\n- R src\/a\/old\.ts -> src\/a\/a\.ts\n- M src\/index\.ts\n\n/);
  assert.match(report, /\nSurface differences:\n- src\/index\.ts\n\n/);
  assert.deepEqual(JSON.parse(jsonOf(result)), JSON.parse(JSON.stringify(result)));
});
