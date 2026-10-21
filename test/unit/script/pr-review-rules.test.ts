import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { Document, stringify } from 'yaml';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { rulesOf } = await import(new URL('rules.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/rules.ts');

const where = 'The rules file r.yaml at HEAD';
const triggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];

function documentOf() {
  return {
    routes: { order: ['FIX', 'CLARIFICATION_NEEDED', 'ARCHITECT_REVIEW_NEEDED', 'SHIP'] },
    protected_paths: {
      policy: { route: 'CLARIFICATION_NEEDED', question: 'Who decides?', paths: ['AGENTS.md', '.github/**'] },
      contracts: { route: 'CLARIFICATION_NEEDED', question: 'What does a client see?', paths: ['src/index.ts'] },
    },
    read_paths: { route: 'ARCHITECT_REVIEW_NEEDED', paths: ['.ast-metrics-baseline.yaml'], moved_by_stop_rule: ['src/a.ts'] },
    scopes: { production: ['src/**'], generated: ['docs/metrics/**'] },
    size: {
      production_lines_read_above: 400, total_lines_read_above: 1500,
      test_counts: { fewer_tests_than_base: 'ARCHITECT_REVIEW_NEEDED', more_skipped_or_todo_than_base: 'ARCHITECT_REVIEW_NEEDED' }, habit_hooks_snooze_non_empty: 'FIX',
    },
    public_surface: {
      contract_documents: 'docs/reference/**',
      external: ['src/index.ts'], between_packages: { auth: ['src/auth/a.ts'], http: ['src/http/b.ts'] }, documented: ['src/c.ts'],
    },
    dependency_graph: {
      counting: { unresolved_relative_import: 'FIX' },
      triggers: { ...Object.fromEntries(triggers.map((name) => [name, 'FIX'])), runtime_edge_becomes_type: 'none' },
      packages: ['auth', 'http', 'composition'],
      allowed_edges: [{ from: 'auth', to: 'http', kind: 'runtime' }, { from: 'composition', to: 'auth', kind: 'both' }],
      forbidden_edges: [{ from: 'http', to: 'auth' }, { from: 'auth', to: ['composition', 'mcp'] }],
      known_cycles: [{ members: ['auth', 'http'], kind: 'runtime', edges: [], resolve: 'split' }],
      allowed_external_imports: { auth: ['jose'] },
      allowed_node_builtins: { http: ['node:http'] },
    },
    ratchet: {
      maintainability_index: { unit: 'production file', new_file_below: 85, existing_file_drop_read_at: 5 },
      crap: { unit: 'function', new_function_above: 15, changed_legacy_function_at_or_above: 30, changed_function_above_goal_and_worse_than_base: 'later' },
      process_outcomes: 'ast-report/process.json',
      review_findings: 'ast-report/review.json',
    },
  };
}

test('Given a complete rules document, when it is read, then the check gets the lists, limits, and graph rules that it uses', () => {
  const rules = rulesOf(stringify(documentOf()), where);

  assert.deepEqual(rules.protectedPaths, [
    { name: 'policy', question: 'Who decides?', paths: ['AGENTS.md', '.github/**'] },
    { name: 'contracts', question: 'What does a client see?', paths: ['src/index.ts'] },
  ]);
  assert.equal(rules.policyQuestion, 'Who decides?');
  assert.equal(rules.contractsQuestion, 'What does a client see?');
  assert.deepEqual(rules.readPaths, ['.ast-metrics-baseline.yaml', 'src/a.ts']);
  assert.deepEqual(rules.scopes, { production: ['src/**'], generated: ['docs/metrics/**'] });
  assert.deepEqual(rules.limits, { production: 400, total: 1500 });
  assert.deepEqual(rules.surface, { modules: ['src/index.ts', 'src/auth/a.ts', 'src/http/b.ts', 'src/c.ts'], contractDocuments: ['docs/reference/**'] });
  assert.deepEqual(rules.graph.forbiddenEdges, [{ from: 'http', to: ['auth'] }, { from: 'auth', to: ['composition', 'mcp'] }]);
  assert.deepEqual(rules.graph.knownCycles, [{ members: ['auth', 'http'], kind: 'runtime' }]);
  assert.deepEqual(rules.graph.externalImports, new Map([['auth', ['jose']]]));
  assert.deepEqual(rules.graph.nodeBuiltins, new Map([['http', ['node:http']]]));
  assert.deepEqual(rules.maintainability, { newFileBelow: 85, existingFileDropReadAt: 5 });
  assert.deepEqual(rules.crap, { newFunctionAbove: 15, changedLegacyFunctionAtOrAbove: 30 });
});

test('Given contract documents as a list, when the rules are read, then each pattern counts', () => {
  const document = new Document(documentOf());
  document.setIn(['public_surface', 'contract_documents'], ['docs/reference/**', 'docs/api/*.md']);

  assert.deepEqual(rulesOf(String(document), where).surface.contractDocuments, ['docs/reference/**', 'docs/api/*.md']);
});

for (const [name, edit, message] of [
  ['without the package list', (document: Document) => document.deleteIn(['dependency_graph', 'packages']), 'dependency_graph.packages: give a list of text'],
  ['with a limit that is not a number', (document: Document) => document.setIn(['size', 'total_lines_read_above'], 'many'), 'size.total_lines_read_above: give a whole number, 0 or more'],
  ['without a question', (document: Document) => document.deleteIn(['protected_paths', 'contracts', 'question']), 'protected_paths.contracts.question: give a non-empty text'],
  ['without the policy group', (document: Document) => document.deleteIn(['protected_paths', 'policy']), 'protected_paths.policy.question: give a non-empty text'],
  ['with an unknown edge kind', (document: Document) => document.setIn(['dependency_graph', 'allowed_edges', 1, 'kind'], 'static'), 'dependency_graph.allowed_edges[1]: give from, to, and a kind of type, runtime, or both'],
  ['with an edge listed twice', (document: Document) => document.addIn(['dependency_graph', 'allowed_edges'], { from: 'auth', to: 'http', kind: 'type' }), 'dependency_graph.allowed_edges[2]: list each pair of from and to once'],
  ['with a forbidden edge without a target', (document: Document) => document.setIn(['dependency_graph', 'forbidden_edges', 0, 'to'], []), 'dependency_graph.forbidden_edges[0]: give from, and to as a text or a list of text'],
  ['with a cycle of one member', (document: Document) => document.setIn(['dependency_graph', 'known_cycles', 0, 'members'], ['auth']), 'dependency_graph.known_cycles[0]: give two or more members and a kind of runtime or all'],
  ['with a builtin list that is not a list', (document: Document) => document.setIn(['dependency_graph', 'allowed_node_builtins', 'http'], 'node:http'), 'dependency_graph.allowed_node_builtins.http: give a list of text'],
  ['with a surface module that is not text', (document: Document) => document.setIn(['public_surface', 'between_packages', 'auth'], [1]), 'public_surface.between_packages.auth: give a list of text'],
  ['with contract documents that are not text', (document: Document) => document.setIn(['public_surface', 'contract_documents'], 3), 'public_surface.contract_documents: give a text or a list of text'],
  ['with another route order', (document: Document) => document.setIn(['routes', 'order'], ['FIX', 'ARCHITECT_REVIEW_NEEDED', 'CLARIFICATION_NEEDED', 'SHIP']), 'routes.order: give FIX, CLARIFICATION_NEEDED, ARCHITECT_REVIEW_NEEDED, SHIP, the order that the check uses'],
  ['with a protected group of another route', (document: Document) => document.setIn(['protected_paths', 'contracts', 'route'], 'ARCHITECT_REVIEW_NEEDED'), 'protected_paths.contracts.route: give CLARIFICATION_NEEDED, the route that the check uses'],
  ['with read paths of another route', (document: Document) => document.deleteIn(['read_paths', 'route']), 'read_paths.route: give ARCHITECT_REVIEW_NEEDED, the route that the check uses'],
  ['with a trigger of another route', (document: Document) => document.setIn(['dependency_graph', 'triggers', 'forbidden_edge'], 'CLARIFICATION_NEEDED'), 'dependency_graph.triggers.forbidden_edge: give FIX, the route that the check uses'],
  ['with an unresolved import of another route', (document: Document) => document.setIn(['dependency_graph', 'counting', 'unresolved_relative_import'], 'ARCHITECT_REVIEW_NEEDED'), 'dependency_graph.counting.unresolved_relative_import: give FIX, the route that the check uses'],
  ['with a snooze file of another route', (document: Document) => document.setIn(['size', 'habit_hooks_snooze_non_empty'], 'ARCHITECT_REVIEW_NEEDED'), 'size.habit_hooks_snooze_non_empty: give FIX, the route that the check uses'],
  ['with fewer tests of another route', (document: Document) => document.setIn(['size', 'test_counts', 'fewer_tests_than_base'], 'FIX'), 'size.test_counts.fewer_tests_than_base: give ARCHITECT_REVIEW_NEEDED, the route that the check uses'],
  ['without the MI limit of a new file', (document: Document) => document.deleteIn(['ratchet', 'maintainability_index', 'new_file_below']), 'ratchet.maintainability_index.new_file_below: give a whole number, 0 or more'],
  ['with an MI drop that is a text', (document: Document) => document.setIn(['ratchet', 'maintainability_index', 'existing_file_drop_read_at'], 'five'), 'ratchet.maintainability_index.existing_file_drop_read_at: give a whole number, 0 or more'],
  ['without the CRAP goal of a new function', (document: Document) => document.deleteIn(['ratchet', 'crap', 'new_function_above']), 'ratchet.crap.new_function_above: give a whole number, 0 or more'],
  ['with a CRAP goal of 10 for a new function', (document: Document) => document.setIn(['ratchet', 'crap', 'new_function_above'], 10), 'ratchet.crap.new_function_above: give 15; the check supports the goals 15 and 30 only'],
  ['with a CRAP goal of 40 for a changed function', (document: Document) => document.setIn(['ratchet', 'crap', 'changed_legacy_function_at_or_above'], 40), 'ratchet.crap.changed_legacy_function_at_or_above: give 30; the check supports the goals 15 and 30 only'],
  ['with a number as the location of the stage outcomes', (document: Document) => document.setIn(['ratchet', 'process_outcomes'], 1), 'ratchet.process_outcomes: give a non-empty text, or leave it out'],
  ['with an empty location of the review findings', (document: Document) => document.setIn(['ratchet', 'review_findings'], ' '), 'ratchet.review_findings: give a non-empty text, or leave it out'],
] as const) {
  test(`Given a rules document ${name}, when it is read, then the diagnostic names the key`, () => {
    const document = new Document(documentOf());
    edit(document);

    assert.throws(() => rulesOf(String(document), where), { message: `${where} has no valid key ${message}.` });
  });
}

for (const pattern of ['{src,test}/**', 'src/[ab].ts', '!src/**', 'src\\a.ts', '/src/**', 'src/', 'src//a.ts', './src/**', 'src/../a.ts', 'src/./a.ts']) {
  test(`Given the pattern ${JSON.stringify(pattern)}, when the rules are read, then the diagnostic names the scope`, () => {
    const document = new Document(documentOf());
    document.addIn(['scopes', 'production'], pattern);

    assert.throws(() => rulesOf(String(document), where), {
      message: `${where} has no valid key scopes.production: give repository paths with only **, * and ? as wildcards, not ${pattern}.`,
    });
  });
}

test('Given a rules document without the locations of the metrics files, when it is read, then the check accepts it, because it takes the files from --process and --review', () => {
  const document = new Document(documentOf());
  document.deleteIn(['ratchet', 'process_outcomes']);
  document.deleteIn(['ratchet', 'review_findings']);

  assert.deepEqual(rulesOf(String(document), where).scopes.production, ['src/**']);
});

test('Given the trigger runtime_edge_becomes_type with the value none, when the rules are read, then the check accepts it, because it does not implement that trigger', () => {
  assert.equal(rulesOf(stringify(documentOf()), where).graph.packages.length, 3);
});

test('Given text that is not valid YAML, when it is read, then the diagnostic says so on one line', () => {
  assert.throws(() => rulesOf('protected_paths: [policy\n', where), (error: Error) => {
    assert.match(error.message, /^The rules file r\.yaml at HEAD is not valid YAML: \S[^\n]*$/);
    return true;
  });
});

test('Given an empty document, when it is read, then the diagnostic names the first key that the check uses', () => {
  assert.throws(() => rulesOf('', where), { message: `${where} has no valid key protected_paths: give a map.` });
});
