import { crapAbsoluteOf } from './crap-absolute.ts';
import { compareCrapDifference } from '../architecture/crap-score.ts';
import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

type Operands = Parameters<typeof crapAbsoluteOf>[0];
type Observation = ReturnType<typeof crapAbsoluteOf>['observation'];
interface Input { readonly head?: Operands; readonly ceiling: number }
interface Goal { readonly state: 'PASS' | 'MISS' | 'UNKNOWN'; readonly reason: string }
interface CeilingResult {
  readonly observation: { readonly head?: Observation; readonly ceiling: number };
  readonly withinCeiling: Goal;
}

// Compliance with a supplied ceiling proves no exception validity, identity,
// history, approval, or review route. Known score displays are not proof inputs.
export function crapCeilingOf(input: Input): CeilingResult {
  if (!isJsonObject(input)) throw new CommandError('Invalid CRAP ceiling input at input: expected an object.');
  const ceiling = ceilingIn(input.ceiling);
  const head = headIn(input.head);
  return {
    observation: { ...(head === undefined ? {} : { head }), ceiling },
    withinCeiling: head === undefined
      ? { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' }
      : goalOf(head, ceiling),
  };
}

function ceilingIn(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CommandError('Invalid CRAP ceiling input at ceiling: expected a finite nonnegative number.');
  }
  return value;
}

function headIn(value: unknown): Observation | undefined {
  if (value === undefined) return undefined;
  try { return crapAbsoluteOf(value as Operands).observation; }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid CRAP ceiling input at head: ${error.message}`);
  }
}

function goalOf(head: Observation, ceiling: number): Goal {
  if (head.kind === 'proven-zero') return { state: 'PASS', reason: 'Zero paths prove CRAP <= the supplied ceiling.' };
  if (head.kind === 'known-coverage') {
    const comparison = compareCrapDifference({ paths: head.paths, share: head.share }, ceiling, 0);
    return comparison <= 0
      ? { state: 'PASS', reason: 'The operands prove CRAP <= the supplied ceiling.' }
      : { state: 'MISS', reason: 'The operands prove CRAP > the supplied ceiling.' };
  }
  if (head.upper <= ceiling) return { state: 'PASS', reason: 'The upper bound proves CRAP <= the supplied ceiling.' };
  if (head.lower > ceiling) return { state: 'MISS', reason: 'The lower bound proves CRAP > the supplied ceiling.' };
  return { state: 'UNKNOWN', reason: 'The possible CRAP range crosses the supplied ceiling.' };
}
