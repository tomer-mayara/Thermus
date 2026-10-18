// CRAP (Change Risk Anti-Patterns, Savoia and Evans 2007) of each src/ function, as
// docs/implementation/architecture-evolution-plan.md ("CRAP per function") gives it: paths² × (1 − share)³ + paths,
// with the covered share of the function's own code in the unit suite.
import type { TableFile } from './ast-metrics-architecture-types.ts';
import { rounded } from './ast-metrics-snapshot-numbers.ts';

// A function at this CRAP or above is over the limit.
export const crapLimit = 30;

export interface FunctionCrap {
  readonly name: string;
  readonly paths: number;
  readonly share: number;
  // With one decimal, as the output gives it, so that the limit applies to the value that a reader sees.
  readonly crap: number;
}

// The functions of a file that have a CRAP, and the count of the functions that have none.
export interface FileCrap {
  readonly functions: readonly FunctionCrap[];
  readonly unmatched: number;
}

// Gives the share of a function from its name and its key, or undefined when the function has no CRAP.
export type ShareRule = (name: string, key: string) => number | undefined;

export function isOver({ crap }: FunctionCrap): boolean {
  return crap >= crapLimit;
}

// A key that the file has twice names no single function, so neither function gets a CRAP.
export function fileCrapOf(file: TableFile, shareOf: ShareRule): FileCrap {
  const functions = file.functions ?? [];
  const keys = functions.map(({ name }) => keyOf(name));
  const crap = functions.flatMap(({ name, paths }, index): FunctionCrap[] => {
    const key = keys[index];
    const share = key !== undefined && keys.indexOf(key) === keys.lastIndexOf(key) ? shareOf(name, key) : undefined;
    return share === undefined ? [] : [{ name, paths, share, crap: rounded(paths ** 2 * (1 - share) ** 3 + paths, 1) }];
  });
  return { functions: crap, unmatched: functions.length - crap.length };
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
