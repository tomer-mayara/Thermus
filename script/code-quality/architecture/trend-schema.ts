import { isJsonObject, isoDateOf, textOf } from '../shared/json.ts';

export type Rule = (value: unknown) => boolean;
export type Fields = Readonly<Record<string, Rule>>;
export const count: Rule = (value) => Number.isSafeInteger(value) && (value as number) >= 0;
export const finite: Rule = (value) => typeof value === 'number' && Number.isFinite(value);
export const nonemptyText: Rule = (value) => Boolean(textOf(value));
export const text: Rule = (value) => typeof value === 'string';
export const commit: Rule = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
export const date: Rule = (value) => isoDateOf(value) !== undefined;
export const version: Rule = (value) => value === 1;

export const communityFields: Fields = {
  label: nonemptyText, files: count, loc: count, paths: count,
  maintainability: optional(finite), functionsOver30: optional(count),
};
export const componentFields: Fields = {
  name: nonemptyText, files: count, loc: count, paths: count,
  maintainability: optional(finite), functionsOver30: optional(count),
};
export function optional(rule: Rule): Rule {
  return (value) => value === undefined || rule(value);
}

export function validFields(value: unknown, rules: Fields): boolean {
  if (!isJsonObject(value)) return false;
  return Object.entries(rules).every(([name, rule]) => rule(value[name]));
}
