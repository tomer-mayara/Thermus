export type JsonObject = Readonly<Record<string, unknown>>;

export function jsonOf(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A value that is not an object gives an object without values, so that the caller can read a field without a check.
export function objectOf(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
