import { miDeclineOf } from './mi-decline.ts';
import { isJsonObject, type JsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

interface RawMi { readonly base?: number; readonly head?: number; readonly acceptedBest?: number }
interface Mi85 { readonly state: 'MEETS' | 'LOW' | 'UNKNOWN'; readonly reason: string }
type DeclineGoal = ReturnType<typeof miDeclineOf>['belowFive'];
interface MiAssessment {
  readonly observation: RawMi;
  readonly mi85: Mi85;
  readonly prDecline: DeclineGoal;
  readonly cumulativeDecline: DeclineGoal;
  readonly noPrDeterioration: DeclineGoal;
}

// These are independent calculations over supplied raw MI. The caller chooses
// references and proves identity, comparable evidence, and accepted history.
export function miAssessmentOf(input: RawMi): MiAssessment {
  if (!isJsonObject(input)) throw new CommandError('Invalid MI assessment input at input: expected an object.');
  const observation = observationOf(input);
  const pr = miDeclineOf({ reference: observation.base, head: observation.head });
  const cumulative = miDeclineOf({ reference: observation.acceptedBest, head: observation.head });
  return {
    observation,
    mi85: floorOf(observation.head),
    prDecline: pr.belowFive,
    cumulativeDecline: cumulative.belowFive,
    noPrDeterioration: pr.noDeterioration,
  };
}

function observationOf(input: JsonObject): RawMi {
  const base = rawIn(input.base, 'base');
  const head = rawIn(input.head, 'head');
  const acceptedBest = rawIn(input.acceptedBest, 'acceptedBest');
  return {
    ...(base === undefined ? {} : { base }),
    ...(head === undefined ? {} : { head }),
    ...(acceptedBest === undefined ? {} : { acceptedBest }),
  };
}

function rawIn(value: unknown, label: 'base' | 'head' | 'acceptedBest'): number | undefined {
  try { return miDeclineOf({ head: value as number | undefined }).observation.head; }
  catch (error) {
    if (!(error instanceof CommandError)) throw error;
    throw new CommandError(`Invalid MI assessment input at ${label}: ${error.message}`);
  }
}

function floorOf(head: number | undefined): Mi85 {
  if (head === undefined) return { state: 'UNKNOWN', reason: 'Head raw MI is missing.' };
  return head >= 85
    ? { state: 'MEETS', reason: 'Raw MI is at least 85.' }
    : { state: 'LOW', reason: 'Raw MI is below 85.' };
}
