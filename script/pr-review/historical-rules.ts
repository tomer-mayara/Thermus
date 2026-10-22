import { invalidKey, isRecord, recordAt, textListAt, valueAt } from './rules-values.ts';
import { tierNames, tiers } from './types.ts';

const formerOrders = [
  ['FIX', 'CLARIFICATION_NEEDED', 'ARCHITECT_REVIEW_NEEDED', 'SHIPPED'],
  ['FIX', 'ASK', 'READ', 'SHOW', 'SHIP'],
] as const;

// Only the merge base may use an older vocabulary. It keeps its thresholds and review requirements.
export function currentRulesDocument(document: unknown, where: string, allowHistorical: boolean): { document: unknown; historical: boolean } {
  if (valueAt(document, 'tiers.order') !== undefined || !allowHistorical) return { document, historical: false };
  const order = textListAt(document, 'routes.order', where);
  const historical = formerOrders.find((known) => known.join() === order.join());
  if (historical === undefined) throw invalidKey(where, 'routes.order', 'give a supported historical order');
  if (valueAt(document, 'version') !== 1) throw invalidKey(where, 'version', 'give 1 for the supported historical schema');
  const groups = recordAt(document, 'protected_paths', where);
  for (const name of Object.keys(groups)) {
    if (valueAt(groups[name], 'route') !== historical[1]) throw invalidKey(where, `protected_paths.${name}.route`, `give ${historical[1]}`);
  }
  if (valueAt(document, 'read_paths.route') !== historical[2]) throw invalidKey(where, 'read_paths.route', `give ${historical[2]}`);
  checkHistoricalOutcomes(document, where, historical[2]);
  return { document: translate(document, groups), historical: true };
}

function translate(document: unknown, groups: Readonly<Record<string, unknown>>) {
  const original = recordAt({ value: document }, 'value', 'The historical rules');
  const graph = recordAt(document, 'dependency_graph', 'The historical rules');
  const size = recordAt(document, 'size', 'The historical rules');
  return {
    ...original,
    version: 2,
    tiers: { order: tiers, names: tierNames },
    protected_paths: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, { ...(isRecord(group) ? group : {}), tier: 'T2' }])),
    read_paths: { ...recordAt(document, 'read_paths', 'The historical rules'), tier: 'T1' },
    dependency_graph: {
      ...graph, counting: { ...recordAt(graph, 'counting', 'The historical rules'), unresolved_relative_import: 'blocked' },
      triggers: Object.fromEntries(Object.entries(recordAt(graph, 'triggers', 'The historical rules')).map(([name, value]) => [name, value === 'FIX' ? 'blocked' : value])),
    },
    size: { ...size, test_counts: { fewer_tests_than_base: 'T1', more_skipped_or_todo_than_base: 'T1' }, habit_hooks_snooze_non_empty: 'blocked' },
    metrics: { process_paths: ['**'] },
  };
}

function checkHistoricalOutcomes(document: unknown, where: string, review: string): void {
  const triggers = recordAt(document, 'dependency_graph.triggers', where);
  const expected: readonly (readonly [string, string])[] = [
    ...Object.keys(triggers).filter((key) => key !== 'runtime_edge_becomes_type').map((key) => [`dependency_graph.triggers.${key}`, 'FIX'] as const),
    ['dependency_graph.counting.unresolved_relative_import', 'FIX'],
    ['size.habit_hooks_snooze_non_empty', 'FIX'],
    ['size.test_counts.fewer_tests_than_base', review],
    ['size.test_counts.more_skipped_or_todo_than_base', review],
  ];
  const wrong = expected.find(([key, value]) => valueAt(document, key) !== value);
  if (wrong) throw invalidKey(where, wrong[0], `give ${wrong[1]}`);
}
