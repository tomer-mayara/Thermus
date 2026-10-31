import { countOf } from './risk-counts.ts';
import { cellOf, type Side } from './format.ts';
import type { CrapDelta } from './crap-delta.ts';
import { crapLimit, type FileCrap } from './crap.ts';
import { textOrder } from '../shared/order.ts';
import { addedOrWorseLines, unmeasuredLines } from './function-lines.ts';

// A side without a function that has a CRAP, such as a file of types, is not measured.
export function crapCellOf(delta: CrapDelta, path: string, oldPath = path): string {
  return cellOf(sideOf(delta.base.get(oldPath), 'new'), sideOf(delta.head.get(path), 'gone'), 0);
}

function sideOf(file: FileCrap | undefined, absent: 'new' | 'gone'): Side {
  if (file === undefined) return absent;
  return file.functions.every(({ share, paths }) => share === undefined && paths < crapLimit) ? 'not measured' : countOf(file.functions);
}

// The paths come sorted, so the list is in the order of the paths and then of the names that it shows. The unmatched
// functions are those of the changed files, which the list cannot judge.
export function functionListOf(delta: CrapDelta, paths: readonly string[]): string[] {
  const ordered = [...paths].sort(textOrder);
  const listed = ordered.flatMap((path) => addedOrWorseLines(path, delta.head.get(path)?.functions ?? []));
  const unmeasured = ordered.flatMap((path) => unmeasuredLines(path, delta.head.get(path)?.functions ?? []));
  const unmatched = paths.reduce((sum, path) => sum + (delta.head.get(path)?.unmatched ?? 0), 0);
  return [
    '### Functions at CRAP 30 or more, added or worse',
    '',
    ...(listed.length === 0 ? ['None.'] : listed),
    '',
    `Unmatched functions: ${unmatched} (anonymous, duplicate, or not in the coverage).`,
    ...unmeasured,
  ];
}
