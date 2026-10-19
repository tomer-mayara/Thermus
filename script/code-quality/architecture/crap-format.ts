import type { FunctionCrap } from './crap.ts';
import { compareCrap } from './crap-score.ts';

// Keep the usual precision unless it could hide which side of a goal the score is on.
export function crapTextOf(entry: FunctionCrap | number, thresholds: readonly number[] = [30]): string {
  if (typeof entry === 'number') return precisionTextOf(entry, (threshold) => Math.sign(entry - threshold), thresholds);
  if (entry.share === undefined) return `≥ ${entry.paths}`;
  return precisionTextOf(entry.crap, (threshold) => compareCrap(entry, threshold), thresholds);
}

function precisionTextOf(value: number, compare: (threshold: number) => number, thresholds: readonly number[]): string {
  const rounded = value.toFixed(1);
  for (const threshold of thresholds) {
    const comparison = compare(threshold);
    if (value === threshold && comparison !== 0) return `${comparison < 0 ? '<' : '>'} ${threshold}`;
    if (Math.sign(Number(rounded) - threshold) !== comparison) return String(value);
  }
  return rounded;
}
