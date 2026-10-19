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

// A date and a time of ISO 8601, as git gives the committer date (%cI). The trend sorts its records by this time, and
// the day of the date in the time zone of the commit names the record.
export function isoDateOf(value: unknown): string | undefined {
  const text = textOf(value);
  if (text === undefined || !/^\d{4}-\d{2}-\d{2}T/u.test(text) || Number.isNaN(Date.parse(text))) return undefined;
  return text;
}
