import { crapAbsoluteOf } from './crap-absolute.ts';
import { compareCrapDifference } from '../architecture/crap-score.ts';
import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

type Operands = Parameters<typeof crapAbsoluteOf>[0];
type Observation = ReturnType<typeof crapAbsoluteOf>['observation'];
type ExactScore = Parameters<typeof compareCrapDifference>[0];
interface Input { readonly reference?: Operands; readonly head?: Operands }
interface Observations { readonly reference?: Observation; readonly head?: Observation }
interface Endpoints { readonly lower: ExactScore; readonly upper: ExactScore }
interface GoalResult { readonly state: 'PASS' | 'MISS' | 'UNKNOWN'; readonly reason: string }
interface Deterioration {
  readonly observation: Observations;
  readonly belowFive: GoalResult;
  readonly noDeterioration: GoalResult;
}

// The caller supplies comparable operands and chooses the reference. This
// calculation does not establish identity, history, exceptions, or a route.
export function crapDeteriorationOf(input: Input): Deterioration {
  if (!isJsonObject(input)) throw new CommandError('Invalid CRAP deterioration input at input: expected an object.');
  const reference = observationOf(input.reference, 'reference');
  const head = observationOf(input.head, 'head');
  const observation = { ...(reference === undefined ? {} : { reference }), ...(head === undefined ? {} : { head }) };
  if (reference === undefined || head === undefined) return unknownDeteriorationOf(observation);
  const before = endpointsOf(reference);
  const after = endpointsOf(head);
  const exact = reference.kind !== 'missing-coverage' && head.kind !== 'missing-coverage';
  return {
    observation,
    belowFive: belowFiveOf(
      compareCrapDifference(after.lower, before.upper, 5),
      compareCrapDifference(after.upper, before.lower, 5), exact,
    ),
    noDeterioration: noDeteriorationOf(
      compareCrapDifference(after.lower, before.upper, 0),
      compareCrapDifference(after.upper, before.lower, 0), exact,
    ),
  };
}

function observationOf(value: unknown, side: 'reference' | 'head'): Observation | undefined {
  if (value === undefined) return undefined;
  try { return crapAbsoluteOf(value as Operands).observation; }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid CRAP deterioration input at ${side}: ${error.message}`);
  }
}

function endpointsOf(observation: Observation): Endpoints {
  if (observation.kind === 'missing-coverage') return { lower: observation.lower, upper: observation.upper };
  if (observation.kind === 'proven-zero') return { lower: 0, upper: 0 };
  const operands = { paths: observation.paths, share: observation.share };
  return { lower: operands, upper: operands };
}

function belowFiveOf(lower: number, upper: number, exact: boolean): GoalResult {
  if (upper < 0) return { state: 'PASS', reason: exact ? 'The operands prove CRAP deterioration <5.' : 'The upper bound proves CRAP deterioration <5.' };
  if (lower >= 0) return { state: 'MISS', reason: exact ? 'The operands prove CRAP deterioration >=5.' : 'The lower bound proves CRAP deterioration >=5.' };
  return { state: 'UNKNOWN', reason: 'The bounds do not settle whether CRAP deterioration is below 5.' };
}

function noDeteriorationOf(lower: number, upper: number, exact: boolean): GoalResult {
  if (upper <= 0) return { state: 'PASS', reason: exact ? 'The operands prove no CRAP deterioration.' : 'The upper bound proves no CRAP deterioration.' };
  if (lower > 0) return { state: 'MISS', reason: exact ? 'The operands prove CRAP deterioration >0.' : 'The lower bound proves CRAP deterioration >0.' };
  return { state: 'UNKNOWN', reason: 'The bounds do not settle whether CRAP deteriorates.' };
}

function unknownDeteriorationOf(observation: Observations): Deterioration {
  const reason = observation.reference === undefined && observation.head === undefined
    ? 'Reference and head CRAP operands are missing.'
    : observation.reference === undefined ? 'Reference CRAP operands are missing.' : 'Head CRAP operands are missing.';
  return { observation, belowFive: { state: 'UNKNOWN', reason }, noDeterioration: { state: 'UNKNOWN', reason } };
}
