import { crapAbsoluteOf } from './crap-absolute.ts';
import { crapDeteriorationOf } from './crap-deterioration.ts';
import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

type Operands = Parameters<typeof crapAbsoluteOf>[0];
type Absolute = ReturnType<typeof crapAbsoluteOf>;
type Observation = Absolute['observation'];
type Goal = ReturnType<typeof crapDeteriorationOf>['belowFive'];
interface Input { readonly base?: Operands; readonly head?: Operands; readonly acceptedBest?: Operands }
interface Observations { readonly base?: Observation; readonly head?: Observation; readonly acceptedBest?: Observation }
interface CrapAssessment {
  readonly observation: Observations;
  readonly atMost15: Goal;
  readonly below30: Goal;
  readonly prDecline: Goal;
  readonly cumulativeDecline: Goal;
  readonly noPrDeterioration: Goal;
}

// Both absolute goals stay separate. The caller chooses references and proves
// applicability, comparable evidence, identity, and accepted history.
export function crapAssessmentOf(input: Input): CrapAssessment {
  if (!isJsonObject(input)) throw new CommandError('Invalid CRAP assessment input at input: expected an object.');
  const base = absoluteIn(input.base, 'base');
  const head = absoluteIn(input.head, 'head');
  const acceptedBest = absoluteIn(input.acceptedBest, 'acceptedBest');
  const pr = crapDeteriorationOf({ reference: operandsOf(base), head: operandsOf(head) });
  const cumulative = crapDeteriorationOf({ reference: operandsOf(acceptedBest), head: operandsOf(head) });
  return {
    observation: observationsOf(base, head, acceptedBest),
    atMost15: head?.atMost15 ?? missingHeadGoal(),
    below30: head?.below30 ?? missingHeadGoal(),
    prDecline: pr.belowFive,
    cumulativeDecline: cumulative.belowFive,
    noPrDeterioration: pr.noDeterioration,
  };
}

function absoluteIn(value: unknown, label: 'base' | 'head' | 'acceptedBest'): Absolute | undefined {
  if (value === undefined) return undefined;
  try { return crapAbsoluteOf(value as Operands); }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid CRAP assessment input at ${label}: ${error.message}`);
  }
}

function operandsOf(absolute: Absolute | undefined): Operands | undefined {
  if (absolute === undefined) return undefined;
  const observation = absolute.observation;
  return observation.kind === 'known-coverage'
    ? { paths: observation.paths, share: observation.share }
    : { paths: observation.paths };
}

function observationsOf(base: Absolute | undefined, head: Absolute | undefined, acceptedBest: Absolute | undefined): Observations {
  return {
    ...(base === undefined ? {} : { base: base.observation }),
    ...(head === undefined ? {} : { head: head.observation }),
    ...(acceptedBest === undefined ? {} : { acceptedBest: acceptedBest.observation }),
  };
}

function missingHeadGoal(): Goal {
  return { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' };
}
