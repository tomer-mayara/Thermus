import { isJsonObject, isoDateOf, textOf, type JsonObject } from '../shared/json.ts';
import { validHash, validTrendEvidence } from './trend-basis.ts';
import type { TrendRecord } from './trend-record.ts';

type Rule = (value: unknown) => boolean;
type Fields = Readonly<Record<string, Rule>>;
const count: Rule = (value) => Number.isSafeInteger(value) && (value as number) >= 0;
const finite: Rule = (value) => typeof value === 'number' && Number.isFinite(value);
const nonemptyText: Rule = (value) => Boolean(textOf(value));
const commit: Rule = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const date: Rule = (value) => isoDateOf(value) !== undefined;
const version: Rule = (value) => value === 1;

const communityFields: Fields = {
  label: nonemptyText, files: count, loc: count, paths: count,
  maintainability: optional(finite), functionsOver30: optional(count),
};
const recordFields: Fields = {
  version, commit, date, modularity: finite, crossShare: finite, cycles: count,
  paths: count, files: count, functions: count, communities: validCommunities,
  maintainability: optional(finite), functionsOver30: optional(count), sourceFingerprint: optional(validHash),
};

export function validTrendRecord(value: JsonObject): value is JsonObject & TrendRecord {
  if (!validFields(value, recordFields)) return false;
  return validTrendEvidence(value);
}

function optional(rule: Rule): Rule {
  return (value) => value === undefined || rule(value);
}

function validFields(value: unknown, rules: Fields): boolean {
  if (!isJsonObject(value)) return false;
  return Object.entries(rules).every(([name, rule]) => rule(value[name]));
}

function validCommunities(value: unknown): boolean {
  return Array.isArray(value) && value.every(validCommunity);
}

function validCommunity(value: unknown): boolean {
  return validFields(value, communityFields);
}
