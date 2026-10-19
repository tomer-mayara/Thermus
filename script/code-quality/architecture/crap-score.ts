import type { FunctionCrap } from './crap.ts';

// Decimal fractions keep equality safe, including 25 paths at 80% coverage.
function fractionOf(value: number): readonly [bigint, bigint] {
  const [coefficient, exponent = '0'] = String(value).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  const integer = BigInt(whole + fraction);
  return scale < 0 ? [integer * 10n ** BigInt(-scale), 1n] : [integer, 10n ** BigInt(scale)];
}

function crapFractionOf(paths: number, share: number): readonly [bigint, bigint] {
  const [p, pd] = fractionOf(paths), [c, cd] = fractionOf(share);
  return [p * p * (cd - c) ** 3n + p * pd * cd ** 3n, pd * pd * cd ** 3n];
}

export function crapValueOf(paths: number, share: number): number {
  const [numerator, denominator] = crapFractionOf(paths, share);
  const whole = numerator / denominator;
  const fraction = (numerator % denominator) * 10n ** 20n / denominator;
  return Number(`${whole}.${String(fraction).padStart(20, '0')}`);
}

// The exact comparison also resolves values too close for a Number to distinguish.
export function compareCrap(entry: FunctionCrap, other: FunctionCrap | number): number {
  const first = entry.share === undefined ? fractionOf(entry.paths) : crapFractionOf(entry.paths, entry.share);
  const second = typeof other === 'number' ? fractionOf(other) : other.share === undefined ? fractionOf(other.paths) : crapFractionOf(other.paths, other.share);
  const difference = first[0] * second[1] - second[0] * first[1];
  return Number(difference > 0n) - Number(difference < 0n);
}

