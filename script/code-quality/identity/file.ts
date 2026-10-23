import { CommandError } from '../shared/repository.ts';
import { sourceEvidenceIn } from './source-read.ts';
import type { FunctionIdentity, SourceEvidence } from './types.ts';

interface FunctionEvidence { readonly identity?: FunctionIdentity }

export function fileEvidenceIn(value: unknown, functions: readonly FunctionEvidence[] | undefined): SourceEvidence | undefined {
  const evidence = sourceEvidenceIn(value);
  const identities = (functions ?? []).flatMap((entry) => entry.identity ? [entry.identity] : []);
  const ranges = identities.map((identity) => JSON.stringify([identity.start, identity.end]));
  if (new Set(ranges).size !== ranges.length) {
    throw new CommandError('The snapshot binds more than one metric to the same source range.');
  }
  if (evidence && identities.some(({ version }) => version !== evidence.version)) {
    throw new CommandError('The snapshot mixes source identity normalization versions.');
  }
  if (evidence?.complete && evidence.version === 'typescript-tokens-v1' && !uniqueDeclarations(identities)) {
    throw new CommandError('The legacy snapshot claims complete evidence for ambiguous declaration names.');
  }
  if (evidence?.complete && (!functions || identities.length !== functions.length)) {
    throw new CommandError('The snapshot claims complete source evidence for an unknown function.');
  }
  return evidence;
}

function uniqueDeclarations(identities: readonly FunctionIdentity[]): boolean {
  const declarations = identities.map(({ kind, owner, name }) => JSON.stringify([kind, owner, name]));
  return new Set(declarations).size === declarations.length;
}
