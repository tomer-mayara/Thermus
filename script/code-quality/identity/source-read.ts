import { isJsonObject } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';
import { normalizationVersion } from './types.ts';
import type { SourceEvidence } from './types.ts';

export function sourceEvidenceIn(value: unknown): SourceEvidence | undefined {
  if (value === undefined) return undefined;
  if (!isJsonObject(value) || !['typescript-tokens-v1', normalizationVersion].includes(value.version as string) || value.coordinates !== 'utf16' || typeof value.complete !== 'boolean') throw new CommandError('The snapshot has invalid source evidence metadata.');
  return { version: value.version as SourceEvidence['version'], coordinates: 'utf16', complete: value.complete };
}
