import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

interface Operands { readonly reference?: number; readonly head?: number }
interface GoalResult { readonly state: 'PASS' | 'MISS' | 'UNKNOWN'; readonly reason: string }
interface MiDecline {
  readonly observation: Operands;
  readonly belowFive: GoalResult;
  readonly noDeterioration: GoalResult;
}

// These are arithmetic results over supplied raw values. The caller must prove
// comparability and choose the reference; no history or identity is inferred.
export function miDeclineOf(input: Operands): MiDecline {
  if (!isJsonObject(input)) invalid('input', 'an object');
  const reference = rawIn(input.reference, 'reference');
  const head = rawIn(input.head, 'head');
  const observation = { ...(reference === undefined ? {} : { reference }), ...(head === undefined ? {} : { head }) };
  if (reference === undefined || head === undefined) return unknownDeclineOf(observation);
  const [belowFive, noDeterioration] = comparisonsOf(reference, head);
  return {
    observation,
    belowFive: belowFive
      ? { state: 'PASS', reason: 'Raw MI decline is below 5.' }
      : { state: 'MISS', reason: 'Raw MI decline is at least 5.' },
    noDeterioration: noDeterioration
      ? { state: 'PASS', reason: 'Raw MI does not deteriorate.' }
      : { state: 'MISS', reason: 'Raw MI deteriorates.' },
  };
}

function unknownDeclineOf(observation: Operands): MiDecline {
  const reason = observation.reference === undefined && observation.head === undefined
    ? 'Reference and head raw MI are missing.'
    : observation.reference === undefined ? 'Reference raw MI is missing.' : 'Head raw MI is missing.';
  return { observation, belowFive: { state: 'UNKNOWN', reason }, noDeterioration: { state: 'UNKNOWN', reason } };
}

function comparisonsOf(reference: number, head: number): readonly [boolean, boolean] {
  const [before, beforeScale] = decimalOf(reference);
  const [after, afterScale] = decimalOf(head);
  const scale = Math.max(0, beforeScale, afterScale);
  const difference = before * 10n ** BigInt(scale - beforeScale) - after * 10n ** BigInt(scale - afterScale);
  return [difference < 5n * 10n ** BigInt(scale), difference <= 0n];
}

// The decimal representation is the comparison basis. Integer scaling avoids
// rounded subtraction, including subnormal values and opposite finite extremes.
function decimalOf(value: number): readonly [bigint, number] {
  const [coefficient, exponent = '0'] = String(value).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  return [BigInt(whole + fraction), fraction.length - Number(exponent)];
}

function rawIn(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(field, 'a finite number');
  return value;
}

function invalid(field: string, expected: string): never {
  throw new CommandError(`Invalid MI decline input at ${field}: expected ${expected}.`);
}
