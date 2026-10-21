import { compareCrap, crapValueOf } from '../architecture/crap-score.ts';
import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

interface Operands { readonly paths: number; readonly share?: number }
interface GoalResult { readonly state: 'PASS' | 'MISS' | 'UNKNOWN'; readonly reason: string }
type Observation =
  | { readonly kind: 'known-coverage'; readonly paths: number; readonly share: number; readonly displayValue: number }
  | { readonly kind: 'missing-coverage'; readonly paths: number; readonly lower: number; readonly upper: number }
  | { readonly kind: 'proven-zero'; readonly paths: 0; readonly value: 0 };
interface AbsoluteGoals {
  readonly observation: Observation;
  readonly atMost15: GoalResult;
  readonly below30: GoalResult;
}

// Both numeric goals are calculated. The caller must separately prove which rule
// applies. Known-coverage display values do not establish exact goal results.
export function crapAbsoluteOf(input: Operands): AbsoluteGoals {
  const { paths, share } = operandsIn(input);
  if (share !== undefined) return knownCoverageOf(paths, share);
  if (paths === 0) return {
    observation: { kind: 'proven-zero', paths: 0, value: 0 },
    atMost15: { state: 'PASS', reason: 'Zero paths prove CRAP 0.' },
    below30: { state: 'PASS', reason: 'Zero paths prove CRAP 0.' },
  };
  return missingCoverageOf(paths);
}

function knownCoverageOf(paths: number, share: number): AbsoluteGoals {
  const displayValue = crapValueOf(paths, share);
  const entry = { name: '', paths, share, crap: displayValue };
  const targetPass = compareCrap(entry, 15) <= 0;
  const limitPass = compareCrap(entry, 30) < 0;
  return {
    observation: { kind: 'known-coverage', paths, share, displayValue },
    atMost15: targetPass
      ? { state: 'PASS', reason: 'The coverage operands prove CRAP <=15.' }
      : { state: 'MISS', reason: 'The coverage operands prove CRAP >15.' },
    below30: limitPass
      ? { state: 'PASS', reason: 'The coverage operands prove CRAP <30.' }
      : { state: 'MISS', reason: 'The coverage operands prove CRAP >=30.' },
  };
}

function missingCoverageOf(paths: number): AbsoluteGoals {
  const p = BigInt(paths);
  const upperInteger = p * p + p;
  if (upperInteger > BigInt(Number.MAX_SAFE_INTEGER)) invalid('paths', 'a safe integer upper CRAP bound when coverage is missing');
  const upper = Number(upperInteger);
  return {
    observation: { kind: 'missing-coverage', paths, lower: paths, upper },
    atMost15: upper <= 15
      ? { state: 'PASS', reason: 'The upper bound proves CRAP <=15.' }
      : paths > 15
        ? { state: 'MISS', reason: 'The lower bound proves CRAP >15.' }
        : { state: 'UNKNOWN', reason: 'The possible CRAP range crosses 15.' },
    below30: upper < 30
      ? { state: 'PASS', reason: 'The upper bound proves CRAP <30.' }
      : paths >= 30
        ? { state: 'MISS', reason: 'The lower bound proves CRAP >=30.' }
        : { state: 'UNKNOWN', reason: 'The possible CRAP range reaches or crosses 30.' },
  };
}

function operandsIn(input: Operands): Operands {
  if (!isJsonObject(input)) invalid('input', 'an object');
  const { paths, share } = input;
  if (typeof paths !== 'number' || !Number.isSafeInteger(paths) || paths < 0) invalid('paths', 'a nonnegative safe integer');
  if (share !== undefined && (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1)) invalid('share', 'a finite number from 0 to 1');
  return { paths, share };
}

function invalid(field: string, expected: string): never {
  throw new CommandError(`Invalid absolute CRAP input at ${field}: expected ${expected}.`);
}
