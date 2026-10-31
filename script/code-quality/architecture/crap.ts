// CRAP (Change Risk Anti-Patterns, Savoia and Evans 2007) of each src/ function:
// paths² × (1 − share)³ + paths, with the covered share of its own code in the selected suites.
// See docs/implementation/ast-metrics-review.md, "Show the architecture delta".
// The base estimate uses the head share; no base coverage is measured.
import type { CoverageFunction } from './coverage.ts';
import type { TableFile, MapFunction } from './types.ts';
import type { FunctionIdentity } from '../identity/types.ts';
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

export interface FileCrap {
  readonly functions: readonly FunctionCrap[];
  readonly unmatched: number;
  readonly incomplete?: true;
}

type ShareRule = (fn: MapFunction, index: number) => number | undefined;

export function isOver(entry: FunctionCrap): boolean {
  return compareCrap(entry, crapLimit) >= 0;
}

// Keep each metric row. Source identities can distinguish repeated names.
export function fileCrapOf(file: TableFile, shareOf: ShareRule): FileCrap {
  const functions = file.functions ?? [];
  const crap = functions.map((fn, index): FunctionCrap => {
    const share = shareOf(fn, index);
    return { name: fn.name, paths: fn.paths, share, crap: share === undefined ? fn.paths : crapValueOf(fn.paths, share) };
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

// A file absent from the capture is uncovered. A loaded file needs exact source
// evidence when either side has it. Legacy unique names remain a limited fallback.
export function coverageShareOf(covered: readonly CoverageFunction[] | undefined, file?: TableFile): ShareRule {
  return (fn) => {
    if (covered === undefined) return 0;
    const identity = fn.identity;
    if (identity) {
      const partners = covered.filter((entry) => entry.sourceIdentity && sameIdentity(entry.sourceIdentity, identity));
      return partners.length === 1 ? partners[0].coveredShare : undefined;
    }
    if (file?.sourceEvidence !== undefined || covered.some((entry) => entry.identityRequired || entry.sourceIdentity !== undefined)) return undefined;
    const key = keyOf(fn.name);
    if (key === undefined || (file?.functions ?? [fn]).filter((entry) => keyOf(entry.name) === key).length !== 1) return undefined;
    const partners = covered.filter((entry) => entry.name === key);
    return partners.length === 1 ? partners[0].coveredShare : undefined;
  };
}

function sameIdentity(first: FunctionIdentity, second: FunctionIdentity): boolean {
  return first.version === second.version && first.kind === second.kind && first.owner === second.owner && first.name === second.name &&
    first.start === second.start && first.end === second.end && first.body === second.body && first.signature === second.signature;
}
