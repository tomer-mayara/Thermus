import type { MapEdge, MapNode } from './ast-metrics-architecture-types.ts';

// The order of the UTF-16 code units, in which the snapshot sorts its labels and its paths.
export function textOrder(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}

// The nodes come in the order of their labels, and the edges in the order of the labels of their ends, so that the
// Mermaid text diffs well.
export function byLabel(first: MapNode, second: MapNode): number {
  return textOrder(first.label, second.label);
}

export function byLabels(first: MapEdge, second: MapEdge): number {
  return textOrder(first.from.label, second.from.label) || textOrder(first.to.label, second.to.label);
}
