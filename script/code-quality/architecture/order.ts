import { textOrder } from '../shared/order.ts';
import type { MapEdge, MapNode, TableFile } from './types.ts';

const rankedFiles = 10;

// The nodes come in the order of their labels, and the edges in the order of the labels of their ends, so that the
// Mermaid text diffs well.
export function byLabel(first: MapNode, second: MapNode): number {
  return textOrder(first.label, second.label);
}

export function byLabels(first: MapEdge, second: MapEdge): number {
  return textOrder(first.from.label, second.from.label) || textOrder(first.to.label, second.to.label);
}

// A tie goes to the first path, so that the rank does not depend on the order of the files in a snapshot file.
export function riskRanksOf(files: readonly TableFile[]): ReadonlyMap<string, number> {
  const scored = files.flatMap(({ path, risk }) => (risk === undefined ? [] : [{ path, risk }]));
  scored.sort((first, second) => second.risk - first.risk || textOrder(first.path, second.path));
  return new Map(scored.slice(0, rankedFiles).map(({ path }, index) => [path, index + 1]));
}
