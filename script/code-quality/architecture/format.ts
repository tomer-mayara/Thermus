import type { TableFile } from './types.ts';

const notMeasured = 'not measured';

export type Side = number | 'new' | 'gone' | typeof notMeasured;

interface Measure {
  readonly valueOf: (file: TableFile) => number | undefined;
  readonly digits: number;
}

// ast-metrics gives a maintainability index only to a file with code. A file without an index, such as a file of types,
// has 0 decision paths in the snapshot only because ast-metrics leaves out each value of zero. That 0 is not a
// measurement, so such a file is not measured in both columns.
const measures: readonly Measure[] = [
  { valueOf: (file) => file.maintainability, digits: 1 },
  { valueOf: (file) => (file.maintainability === undefined ? undefined : file.paths), digits: 0 },
];

export function measureCellsOf(before: TableFile | undefined, after: TableFile | undefined): string[] {
  return measures.map((measure) => cellOf(sideOf(before, measure, 'new'), sideOf(after, measure, 'gone'), measure.digits));
}

function sideOf(file: TableFile | undefined, measure: Measure, absent: 'new' | 'gone'): Side {
  if (file === undefined) return absent;
  return measure.valueOf(file) ?? notMeasured;
}

// A file of the head without the value is not measured, also when the base had one: then no change is known. The same
// word shows a file that neither snapshot has, because ast-metrics measured it in neither tree.
export function cellOf(before: Side, after: Side, digits: number): string {
  if (after === notMeasured || (before === 'new' && after === 'gone')) return notMeasured;
  const change = typeof before === 'number' && typeof after === 'number' ? changeText(after - before, digits) : '';
  return `${textOf(before, digits)} → ${textOf(after, digits)}${change}`;
}

function textOf(side: Side, digits: number): string {
  return typeof side === 'number' ? side.toFixed(digits) : side;
}

export function changeText(change: number | undefined, digits: number): string {
  const text = (change ?? 0).toFixed(digits);
  if (Number(text) === 0) return '';
  return text.startsWith('-') ? ` ↓${text.slice(1)}` : ` ↑${text}`;
}
