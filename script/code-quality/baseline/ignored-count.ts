import { parseDocument } from 'yaml';
import { CommandError } from '../shared/repository.ts';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function baselineEntry(value: unknown): boolean {
  if (!record(value)) return false;
  return ['rule', 'file', 'message'].every((key) => typeof value[key] === 'string' && value[key] !== '')
    && Number.isSafeInteger(value.count) && Number(value.count) > 0;
}

// The tool stores one ignored mapping per finding; count is its occurrence count.
export function ignoredEntryCount(text: string): number {
  try {
    const document = parseDocument(text, { uniqueKeys: true });
    if (document.errors.length > 0) throw new Error('Invalid YAML.');
    const data: unknown = document.toJS({ maxAliasCount: 0 });
    if (!record(data) || !Array.isArray(data.ignored) || !data.ignored.every(baselineEntry)) {
      throw new Error('Invalid ignored entries.');
    }
    return data.ignored.length;
  } catch {
    throw new CommandError('.ast-metrics-baseline.yaml is not a valid ast-metrics baseline. Expected ignored: [] or ignored entries with rule, file, message, and positive integer count.');
  }
}
