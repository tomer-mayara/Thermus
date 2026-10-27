import { addRow, type ProbeContext } from './context.ts';

export type Rule<T> = readonly [string, (value: T) => boolean];

export interface Subject<T> {
  readonly step: string;
  readonly what: string;
  readonly value: T;
  readonly measured?: string;
}

export function checkRules<T>(context: ProbeContext, subject: Subject<T>, rules: readonly Rule<T>[]): void {
  const { step, what, value } = subject;
  const failed = rules.filter(([, holds]) => !holds(value)).map(([name]) => name);
  const measured = failed.length === 0 ? subject.measured ?? 'each rule holds' : `missing: ${failed.join('; ')}${subject.measured === undefined ? '' : ` (${subject.measured})`}`;
  addRow(context, step, { check: what, expected: rules.map(([name]) => name).join('; '), measured });
  if (failed.length > 0) throw new Error(`${what} does not have: ${failed.join('; ')}.`);
}
