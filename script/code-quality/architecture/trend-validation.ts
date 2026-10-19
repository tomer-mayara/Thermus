import * as schema from './trend-schema.ts';
import { isJsonObject, type JsonObject } from '../shared/json.ts';
import { validComponentName } from './component-name.ts';
import { validHash, validTrendEvidence } from './trend-basis.ts';
import type { TrendRecord } from './trend-record.ts';

const recordFields: schema.Fields = {
  version: schema.version, tool: schema.optional(schema.nonemptyText), commit: schema.commit, date: schema.date, title: schema.optional(schema.text), modularity: schema.finite, crossShare: schema.finite, cycles: schema.count,
  paths: schema.count, files: schema.count, functions: schema.count, communities: validCommunities, components: schema.optional(validComponents),
  maintainability: schema.optional(schema.finite), functionsOver30: schema.optional(schema.count), sourceFingerprint: schema.optional(validHash),
};

export function validTrendRecord(value: JsonObject): value is JsonObject & TrendRecord {
  if (!schema.validFields(value, recordFields)) return false;
  return validTrendEvidence(value);
}

function validCommunities(value: unknown): boolean {
  return Array.isArray(value) && value.every(validCommunity);
}

function validCommunity(value: unknown): boolean {
  return schema.validFields(value, schema.communityFields);
}

function validComponents(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const names = new Set<string>();
  return value.every((component) => {
    if (!schema.validFields(component, schema.componentFields) || !isJsonObject(component) || !validTrendEvidence(component)) return false;
    const name = component.name as string;
    if (names.has(name) || !validComponentName(name)) return false;
    if ((component.functionsOver30 === undefined) !== (component.crap === undefined)) return false;
    names.add(name);
    return true;
  });
}
