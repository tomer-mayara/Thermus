import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/command-error.ts';

interface Input { readonly head?: number; readonly floor: number }
interface Goal { readonly state: 'PASS' | 'MISS' | 'UNKNOWN'; readonly reason: string }
interface FloorResult {
  readonly observation: { readonly head?: number; readonly floor: number };
  readonly meetsFloor: Goal;
}

// A supplied floor proves no exception validity, history, approval, or review
// route. This calculation retains raw MI independently of the MI85 warning.
export function miFloorOf(input: Input): FloorResult {
  if (!isJsonObject(input)) throw new CommandError('Invalid MI floor input at input: expected an object.');
  const floor = rawIn(input.floor, 'floor');
  const head = input.head === undefined ? undefined : rawIn(input.head, 'head');
  return {
    observation: { ...(head === undefined ? {} : { head }), floor },
    meetsFloor: goalOf(head, floor),
  };
}

function rawIn(value: unknown, label: 'floor' | 'head'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CommandError(`Invalid MI floor input at ${label}: expected a finite number.`);
  }
  return value;
}

function goalOf(head: number | undefined, floor: number): Goal {
  if (head === undefined) return { state: 'UNKNOWN', reason: 'Head raw MI is missing.' };
  return head >= floor
    ? { state: 'PASS', reason: 'Raw MI is at least the supplied floor.' }
    : { state: 'MISS', reason: 'Raw MI is below the supplied floor.' };
}
