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
    routes: { order: ['FIX', 'ASK', 'READ', 'SHOW', 'SHIP'] },
    protected_paths: {
      policy: { route: 'ASK', question: 'Who decides?', paths: ['AGENTS.md', '.github/**'] },
      contracts: { route: 'ASK', question: 'What does a client see?', paths: ['src/index.ts'] },
    },
    read_paths: { route: 'READ', paths: ['.ast-metrics-baseline.yaml'], moved_by_stop_rule: ['src/a.ts'] },
    scopes: { production: ['src/**'], executable: ['src/**', 'test/**'], generated: ['docs/metrics/**'] },
    size: {
      production_lines_read_above: 400, total_lines_read_above: 1500,
      test_counts: { fewer_tests_than_base: 'READ', more_skipped_or_todo_than_base: 'READ' }, habit_hooks_snooze_non_empty: 'FIX',
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
  assert.deepEqual(rules.scopes, { production: ['src/**'], executable: ['src/**', 'test/**'], generated: ['docs/metrics/**'] });
  assert.deepEqual(rules.limits, { production: 400, total: 1500 });
  assert.deepEqual(rules.surface, { modules: ['src/index.ts', 'src/auth/a.ts', 'src/http/b.ts', 'src/c.ts'], contractDocuments: ['docs/reference/**'] });
  assert.deepEqual(rules.graph.forbiddenEdges, [{ from: 'http', to: ['auth'] }, { from: 'auth', to: ['composition', 'mcp'] }]);
  assert.deepEqual(rules.graph.knownCycles, [{ members: ['auth', 'http'], kind: 'runtime' }]);
  assert.deepEqual(rules.graph.externalImports, new Map([['auth', ['jose']]]));
  assert.deepEqual(rules.graph.nodeBuiltins, new Map([['http', ['node:http']]]));
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
  ['with another route order', (document: Document) => document.setIn(['routes', 'order'], ['FIX', 'READ', 'ASK', 'SHOW', 'SHIP']), 'routes.order: give FIX, ASK, READ, SHOW, SHIP, the order that the check uses'],
  ['with a protected group of another route', (document: Document) => document.setIn(['protected_paths', 'contracts', 'route'], 'READ'), 'protected_paths.contracts.route: give ASK, the route that the check uses'],
  ['with read paths of another route', (document: Document) => document.deleteIn(['read_paths', 'route']), 'read_paths.route: give READ, the route that the check uses'],
  ['with a trigger of another route', (document: Document) => document.setIn(['dependency_graph', 'triggers', 'forbidden_edge'], 'ASK'), 'dependency_graph.triggers.forbidden_edge: give FIX, the route that the check uses'],
  ['with an unresolved import of another route', (document: Document) => document.setIn(['dependency_graph', 'counting', 'unresolved_relative_import'], 'READ'), 'dependency_graph.counting.unresolved_relative_import: give FIX, the route that the check uses'],
  ['with a snooze file of another route', (document: Document) => document.setIn(['size', 'habit_hooks_snooze_non_empty'], 'READ'), 'size.habit_hooks_snooze_non_empty: give FIX, the route that the check uses'],
  ['with fewer tests of another route', (document: Document) => document.setIn(['size', 'test_counts', 'fewer_tests_than_base'], 'FIX'), 'size.test_counts.fewer_tests_than_base: give READ, the route that the check uses'],
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
    document.addIn(['scopes', 'executable'], pattern);

    assert.throws(() => rulesOf(String(document), where), {
      message: `${where} has no valid key scopes.executable: give repository paths with only **, * and ? as wildcards, not ${pattern}.`,
    });
  });
}

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
