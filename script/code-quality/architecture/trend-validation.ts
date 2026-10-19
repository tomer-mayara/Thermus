import { isJsonObject, type JsonObject } from '../shared/json.ts';

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function countIn(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

export function validStructure(fields: JsonObject): boolean {
  return ['paths', 'files', 'functions'].every((key) => countIn(fields[key]) !== undefined)
    && Array.isArray(fields.communities) && fields.communities.every(validCommunity);
}

function validCommunity(value: unknown): boolean {
  if (!isJsonObject(value) || typeof value.label !== 'string' || value.label.length === 0) return false;
  if (!['files', 'loc', 'paths'].every((key) => countIn(value[key]) !== undefined)) return false;
  if (value.maintainability !== undefined && finiteNumber(value.maintainability) === undefined) return false;
  return value.functionsOver30 === undefined || countIn(value.functionsOver30) !== undefined;
}
