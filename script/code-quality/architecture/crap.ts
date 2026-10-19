// CRAP (Change Risk Anti-Patterns, Savoia and Evans 2007) of each src/ function:
// paths² × (1 − share)³ + paths, with the covered share of its own code in the selected suites.
// See docs/implementation/ast-metrics-review.md, "Show the architecture delta".
// The base estimate uses the head share; no base coverage is measured.
import type { CoverageFunction } from './coverage.ts';
import type { TableFile } from './types.ts';
import { compareCrap, crapValueOf } from './crap-score.ts';

// A function at this CRAP or above is over the limit.
export const crapLimit = 30;

export interface FunctionCrap {
  readonly name: string;
  readonly paths: number;
  readonly share: number | undefined;
  // CRAP retains its precision. Without a share, paths gives its lower bound.
  readonly crap: number;
}

// Each function has exact CRAP or a lower bound. Unmatched counts unknown covered shares.
export interface FileCrap {
  readonly functions: readonly FunctionCrap[];
  readonly unmatched: number;
  readonly incomplete?: true;
}

// Gives the covered share, or undefined when it cannot be measured.
type ShareRule = (name: string, key: string) => number | undefined;

export function isOver(entry: FunctionCrap): boolean {
  return compareCrap(entry, crapLimit) >= 0;
}

// A duplicate key gives no unique covered share. Keep each function and its lower bound.
export function fileCrapOf(file: TableFile, shareOf: ShareRule): FileCrap {
  const functions = file.functions ?? [];
  const keys = functions.map(({ name }) => keyOf(name));
  const crap = functions.map(({ name, paths }, index): FunctionCrap => {
    const key = keys[index];
    const share = key !== undefined && keys.indexOf(key) === keys.lastIndexOf(key) ? shareOf(name, key) : undefined;
    return { name, paths, share, crap: share === undefined ? paths : crapValueOf(paths, share) };
  });
  return { functions: crap, unmatched: crap.filter(({ share }) => share === undefined).length, ...(file.functions === undefined ? { incomplete: true as const } : {}) };
}

// The key is the name that V8 gives the function. ast-metrics names a method module\Class.method, and V8 names it method,
// and a constructor Class. A method without a name, such as a function in a class field, is anonymous. An anonymous
// function has no key.
function keyOf(name: string): string | undefined {
  const method = /^[^\\]*\\([^.]*)\.(.*)$/u.exec(name);
  if (method === null) return name === '(anonymous)' ? undefined : name;
  const [, owner, member] = method;
  if (member === 'constructor') return owner;
  return member === '' ? undefined : member;
}

// A file that the report does not have is uncovered: no unit test loaded it. A key that the report has twice or not at
// all names no single function of the report.
export function coverageShareOf(covered: readonly CoverageFunction[] | undefined): ShareRule {
  return (_name, key) => {
    if (covered === undefined) return 0;
    const partners = covered.filter((entry) => entry.name === key);
    return partners.length === 1 ? partners[0].coveredShare : undefined;
  };
}
