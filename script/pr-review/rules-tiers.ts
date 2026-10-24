import { invalidKey, recordAt, textListAt, valueAt } from './rules-values.ts';
import { impactFlags, tierNames, tiers } from './types.ts';

const blockedTriggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];

// The facts of the section architecture. Each is T2 Need architect; the check uses no other tier for them.
const architectureFacts = ['component_set', 'dependency_added', 'public_module_added', 'declarations_changed', 'registry_view_changed', 'decision_record'] as const;

export function checkTiers(document: unknown, where: string): void {
  if (valueAt(document, 'version') !== 2) throw invalidKey(where, 'version', 'give 2');
  if (textListAt(document, 'tiers.order', where).join() !== tiers.join()) throw invalidKey(where, 'tiers.order', `give ${tiers.join(', ')}, the order that the check uses`);
  for (const tier of tiers) {
    if (valueAt(document, `tiers.names.${tier}`) !== tierNames[tier]) throw invalidKey(where, `tiers.names.${tier}`, `give ${tierNames[tier]}`);
  }
  for (const name of Object.keys(recordAt(document, 'protected_paths', where))) {
    const tier = valueAt(document, `protected_paths.${name}.tier`);
    if (tier !== 'T1' && tier !== 'T2') throw invalidKey(where, `protected_paths.${name}.tier`, 'give T1 or T2');
  }
  checkExpected(document, where, [
    ['read_paths.tier', 'T1'],
    ...blockedTriggers.map((name) => [`dependency_graph.triggers.${name}`, 'blocked'] as const),
    ['dependency_graph.counting.unresolved_relative_import', 'blocked'],
    ['size.test_counts.fewer_tests_than_base', 'T1'],
    ['size.habit_hooks_snooze_non_empty', 'blocked'],
  ]);
  const skipped = valueAt(document, 'size.test_counts.more_skipped_or_todo_than_base');
  if (skipped !== 'T1' && skipped !== 'blocked') throw invalidKey(where, 'size.test_counts.more_skipped_or_todo_than_base', 'give T1 or blocked');
  checkArchitecture(document, where);
  checkImpact(document, where);
  checkDependencies(document, where);
}

function checkExpected(document: unknown, where: string, expected: readonly (readonly [string, string])[]): void {
  const wrong = expected.find(([key, value]) => valueAt(document, key) !== value);
  if (wrong) throw invalidKey(where, wrong[0], `give ${wrong[1]}, the outcome that the check uses`);
}

// The sections of 2026-10-24 are optional, so that the rules of an earlier merge base still read. When present, their
// outcomes are the ones that the check uses.
function checkArchitecture(document: unknown, where: string): void {
  if (valueAt(document, 'architecture') === undefined) return;
  checkExpected(document, where, [...architectureFacts.map((fact) => [`architecture.${fact}`, 'T2'] as const), ['architecture.undeclared_fact', 'blocked']]);
}

function checkImpact(document: unknown, where: string): void {
  if (valueAt(document, 'impact') === undefined) return;
  const listed = [...textListAt(document, 'impact.architect', where), ...textListAt(document, 'impact.team', where)];
  const each = impactFlags.every((flag) => listed.filter((name) => name === flag).length === 1);
  if (!each || listed.length !== impactFlags.length) throw invalidKey(where, 'impact', `list each of ${impactFlags.join(', ')} once, under architect or team`);
}

function checkDependencies(document: unknown, where: string): void {
  if (valueAt(document, 'dependencies') === undefined) return;
  checkExpected(document, where, [['dependencies.keys_changed', 'T1'], ['dependencies.external_import_added', 'T1']]);
}
