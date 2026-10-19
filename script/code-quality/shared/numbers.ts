import type { FileMeasurement } from '../snapshot/types.ts';

// A score keeps one decimal and a share two, so that a small change of a value does not change the file. A value that
// ast-metrics did not measure stays absent.
export function rounded(value: number, digits: number): number;
export function rounded(value: number | undefined, digits: number): number | undefined;
export function rounded(value: number | undefined, digits: number): number | undefined {
  return value === undefined ? undefined : Number(value.toFixed(digits));
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

// The sum of index × lines over the sum of lines, for the files that have an index. A plain mean would let a small file
// count as much as a large one. A file without code, such as a file of types, has no index and does not count.
export function weightedMaintainability(files: readonly FileMeasurement[]): number | undefined {
  let weighted = 0;
  let lines = 0;
  for (const { maintainability, loc } of files) {
    if (maintainability === undefined) continue;
    weighted += maintainability * loc;
    lines += loc;
  }
  return lines === 0 ? undefined : rounded(weighted / lines, 1);
}
