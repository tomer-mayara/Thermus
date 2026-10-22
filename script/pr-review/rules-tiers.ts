import { invalidKey, recordAt, textListAt, valueAt } from './rules-values.ts';
import { tierNames, tiers } from './types.ts';

const blockedTriggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];

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
  const expected: readonly (readonly [string, string])[] = [
    ['read_paths.tier', 'T1'],
    ...blockedTriggers.map((name) => [`dependency_graph.triggers.${name}`, 'blocked'] as const),
    ['dependency_graph.counting.unresolved_relative_import', 'blocked'],
    ['size.test_counts.fewer_tests_than_base', 'T1'],
    ['size.test_counts.more_skipped_or_todo_than_base', 'T1'],
    ['size.habit_hooks_snooze_non_empty', 'blocked'],
  ];
  const wrong = expected.find(([key, value]) => valueAt(document, key) !== value);
  if (wrong) throw invalidKey(where, wrong[0], `give ${wrong[1]}, the outcome that the check uses`);
}
