import { correspondenceOf } from './correspondence.ts';
import type { CrapDelta } from './crap-delta.ts';
import type { MapSources } from './types.ts';

export function identityNoticeOf(sources: MapSources, delta: CrapDelta | undefined): string[] {
  const unknown = delta?.unknownIdentity ?? [...correspondenceOf(sources).head.values()].filter(({ classification }) => classification === 'unknown').length;
  const identity = unknown === 0 ? [] : [`Unknown function identity: ${unknown} (no proven declaration or unique unchanged body/signature correspondence).`];
  if (delta === undefined) return identity;
  const baseUnknown = [...delta.base.values()].reduce((sum, file) => sum + file.unmatched, 0);
  return [...identity, `Base functions without an estimated covered share: ${baseUnknown}.`];
}
