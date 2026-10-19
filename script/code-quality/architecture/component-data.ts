import { rounded } from '../shared/numbers.ts';
import { componentNameOf } from './component-name.ts';
import { textOrder } from '../shared/order.ts';
import type { MapSnapshot, TableFile } from './types.ts';

export interface Component {
  readonly name: string;
  readonly members: readonly string[];
  readonly files: number;
  readonly loc?: number;
  readonly maintainability?: number;
  readonly paths?: number;
}

export function componentsOf(snapshot: MapSnapshot): Component[] {
  const groups = new Map<string, TableFile[]>();
  for (const file of snapshot.files) {
    const name = componentNameOf(file.path);
    if (name === undefined) continue;
    const group = groups.get(name) ?? [];
    group.push(file);
    groups.set(name, group);
  }
  return [...groups].sort(([first], [second]) => textOrder(first, second)).map(([name, files]) => aggregateOf(name, files));
}

function aggregateOf(name: string, files: readonly TableFile[]): Component {
  const loc = totalOf(files.map((file) => file.loc));
  const paths = totalOf(files.map((file) => file.paths));
  const maintainability = loc === undefined ? undefined : weightedOf(files);
  return { name, members: files.map((file) => file.path).sort(textOrder), files: files.length, loc, maintainability: rounded(maintainability, 1), paths };
}

function totalOf(values: readonly (number | undefined)[]): number | undefined {
  let total = 0;
  for (const value of values) {
    if (value === undefined) return undefined;
    total += value;
  }
  return total;
}

function weightedOf(files: readonly TableFile[]): number | undefined {
  let weight = 0;
  let total = 0;
  for (const file of files) {
    if (file.maintainability === undefined || file.loc === undefined) continue;
    weight += file.loc;
    total += file.maintainability * file.loc;
  }
  return weight === 0 ? undefined : total / weight;
}
