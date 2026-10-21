import { stringify } from 'yaml';

// A minimal valid rules file for the review route check, and the small source tree that it describes. The packages
// are alpha, beta, and composition: the files directly in src/. betaUsesAlpha adds the runtime edge beta -> alpha.
export const rulesPath = 'docs/implementation/pr-review-rules.yaml';

interface Edge {
  from: string;
  to: string;
  kind: string;
}

const triggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];

export function rulesDocument() {
  return {
    routes: { order: ['FIX', 'ASK', 'READ', 'SHOW', 'SHIP'] },
    protected_paths: {
      policy: { route: 'ASK', question: 'Does this change what the checks enforce? Record the new rule.', paths: ['AGENTS.md', rulesPath] },
      contracts: { route: 'ASK', question: 'Does a client see a different input or output? Record the promise.', paths: ['src/index.ts'] },
    },
    read_paths: { route: 'READ', paths: ['docs/implementation/test-gate-policy.md'], moved_by_stop_rule: [] as string[] },
    scopes: { production: ['src/**'], executable: ['src/**', 'test/**'], generated: ['docs/metrics/**'] },
    public_surface: {
      contract_documents: 'docs/reference/**',
      external: ['src/index.ts'],
      between_packages: { alpha: ['src/alpha/alpha.ts'], beta: ['src/beta/beta.ts'] } as Record<string, string[]>,
      documented: [] as string[],
    },
    dependency_graph: {
      counting: { unresolved_relative_import: 'FIX' },
      triggers: { ...Object.fromEntries(triggers.map((name) => [name, 'FIX'])), runtime_edge_becomes_type: 'none' } as Record<string, string>,
      packages: ['alpha', 'beta', 'composition'],
      allowed_edges: [{ from: 'composition', to: 'alpha', kind: 'runtime' }] as Edge[],
      forbidden_edges: [] as { from: string; to: string | string[] }[],
      known_cycles: [] as { members: string[]; kind: string }[],
      allowed_external_imports: {} as Record<string, string[]>,
      allowed_node_builtins: {} as Record<string, string[]>,
    },
    size: {
      production_lines_read_above: 400,
      total_lines_read_above: 1500,
      test_counts: { fewer_tests_than_base: 'READ', more_skipped_or_todo_than_base: 'READ' },
      habit_hooks_snooze_non_empty: 'FIX',
    },
    ratchet: {
      maintainability_index: { new_file_below: 85, existing_file_drop_read_at: 5 } as Record<string, number>,
      crap: { new_function_above: 15, changed_legacy_function_at_or_above: 30 } as Record<string, number>,
      process_outcomes: 'ast-report/process.json',
      review_findings: 'ast-report/review.json',
    },
  };
}

export type RulesDocument = ReturnType<typeof rulesDocument>;

export function rulesYaml(edit: (rules: RulesDocument) => void = () => undefined): string {
  const rules = rulesDocument();
  edit(rules);
  return stringify(rules);
}

export function mainFiles(rules = rulesYaml()): Record<string, string> {
  return {
    [rulesPath]: rules,
    'AGENTS.md': '# Agents\n',
    'docs/guide.md': '# Guide\n',
    'src/index.ts': "import { alpha } from './alpha/alpha.ts';\n\nexport const value = alpha;\n",
    'src/alpha/alpha.ts': 'export const alpha = 1;\n',
    'src/beta/beta.ts': 'export const beta = 2;\n',
  };
}

// The snapshots of check 4 go to ast-report/, which git ignores, as the snapshot command writes them in the repository.
export function measuredFiles(rules = rulesYaml()): Record<string, string> {
  return { ...mainFiles(rules), '.gitignore': 'ast-report/\n', 'src/alpha/parser.ts': 'export const parser = 1;\n', 'src/alpha/printer.ts': 'export const printer = 1;\n' };
}

export const betaUsesAlpha: Readonly<Record<string, string>> = {
  'src/beta/uses-alpha.ts': "import { alpha } from '../alpha/alpha.ts';\n\nexport const twice = alpha * 2;\n",
};

export const guideChange: Readonly<Record<string, string>> = { 'docs/guide.md': '# Guide\n\nMore text.\n' };

export function testFile(names: readonly string[]): string {
  return `import { test } from 'node:test';\n\n${names.map((name) => `test('${name}', () => {});\n`).join('')}`;
}
