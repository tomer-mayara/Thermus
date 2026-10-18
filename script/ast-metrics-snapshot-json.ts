import { numberOf } from './ast-metrics-json.ts';

export function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function textsOf(value: unknown): string[] {
  return arrayOf(value).filter((item) => typeof item === 'string');
}

// ast-metrics leaves out each value of zero, so an absent number is 0.
export function numberOrZero(value: unknown): number {
  return numberOf(value) ?? 0;
}
