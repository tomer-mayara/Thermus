import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { normalizationVersion } from './types.ts';
import type { SourceEvidence } from './types.ts';

export function sourceEvidenceIn(value: unknown): SourceEvidence | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || value.version !== normalizationVersion || value.coordinates !== 'utf16' || typeof value.complete !== 'boolean') throw new CommandError('The snapshot has invalid source evidence metadata.');
  return { version: normalizationVersion, coordinates: 'utf16', complete: value.complete };
}

