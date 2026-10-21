import { invalidKey, textListAt, valueAt } from './rules-values.ts';

const order = ['FIX', 'ASK', 'READ', 'SHOW', 'SHIP'];
const fixTriggers = [
  'edge_not_listed', 'type_edge_becomes_runtime', 'folder_not_listed', 'package_removed', 'cycle_not_listed',
  'known_cycle_grows', 'cross_package_file_not_in_public_surface', 'external_import_not_listed', 'forbidden_edge',
];

// The check gives each reason a fixed route. A rules file that names another route for it asks for a check that does
// not exist, so the check refuses it. The trigger runtime_edge_becomes_type has no reason, so the check ignores it.
export function checkRoutes(document: unknown, where: string, groups: readonly string[]): void {
  if (textListAt(document, 'routes.order', where).join() !== order.join()) {
    throw invalidKey(where, 'routes.order', `give ${order.join(', ')}, the order that the check uses`);
  }
  const wrong = expectedRoutes(groups).find(([key, route]) => valueAt(document, key) !== route);
  if (wrong) throw invalidKey(where, wrong[0], `give ${wrong[1]}, the route that the check uses`);
}

function expectedRoutes(groups: readonly string[]): (readonly [string, string])[] {
  return [
    ...groups.map((name) => [`protected_paths.${name}.route`, 'ASK'] as const),
    ['read_paths.route', 'READ'],
    ...fixTriggers.map((name) => [`dependency_graph.triggers.${name}`, 'FIX'] as const),
    ['dependency_graph.counting.unresolved_relative_import', 'FIX'],
    ['size.test_counts.fewer_tests_than_base', 'READ'],
    ['size.test_counts.more_skipped_or_todo_than_base', 'READ'],
    ['size.habit_hooks_snooze_non_empty', 'FIX'],
  ];
}
