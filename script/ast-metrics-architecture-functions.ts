// The CRAP column of the complexity table and the list of functions after the table, for the changed files: the count of
// the functions at CRAP 30 or more on each side, and each function that the pull request added or made worse.
import { countOf } from './ast-metrics-architecture-bands.ts';
import { cellOf, type Side } from './ast-metrics-architecture-cells.ts';
import type { CrapDelta, JudgedFunction } from './ast-metrics-architecture-crap-delta.ts';
import type { FileCrap } from './ast-metrics-architecture-crap.ts';
import { textOrder } from './ast-metrics-architecture-order.ts';

interface ListedFunction {
  readonly path: string;
  // ast-metrics names a method module\Class.method, and the path names the module already.
  readonly name: string;
  readonly crap: JudgedFunction;
}

// A side without a function that has a CRAP, such as a file of types, is not measured.
export function crapCellOf(delta: CrapDelta, path: string): string {
  return cellOf(sideOf(delta.base.get(path), 'new'), sideOf(delta.head.get(path), 'gone'), 0);
}

function sideOf(file: FileCrap | undefined, absent: 'new' | 'gone'): Side {
  if (file === undefined) return absent;
  return file.functions.length === 0 ? 'not measured' : countOf(file.functions);
}

// The paths come sorted, so the list is in the order of the paths and then of the names that it shows. The unmatched
// functions are those of the changed files, which the list cannot judge.
export function functionListOf(delta: CrapDelta, paths: readonly string[]): string[] {
  const listed = paths.flatMap((path) => listedIn(path, delta.head.get(path)?.functions ?? []));
  const unmatched = paths.reduce((sum, path) => sum + (delta.head.get(path)?.unmatched ?? 0), 0);
  return [
    '### Functions at CRAP 30 or more, added or worse',
    '',
    ...(listed.length === 0 ? ['None.'] : listed.map(lineOf)),
    '',
    `Unmatched functions: ${unmatched} (anonymous, duplicate, or not in the coverage).`,
  ];
}

function listedIn(path: string, functions: readonly JudgedFunction[]): ListedFunction[] {
  const listed = functions.filter((crap) => crap.addedOrWorse).map((crap) => ({ path, name: crap.name.replace(/^[^\\]*\\/u, ''), crap }));
  return listed.sort((first, second) => textOrder(first.name, second.name));
}

// A share keeps two decimals and a CRAP one, as the formula gives them.
function lineOf({ path, name, crap }: ListedFunction): string {
  const base = typeof crap.base === 'number' ? crap.base.toFixed(1) : 'new';
  return `- \`${path}\` \`${name}\`: paths ${crap.paths}, covered ${crap.share.toFixed(2)}, CRAP ${crap.crap.toFixed(1)} (base ${base})`;
}
