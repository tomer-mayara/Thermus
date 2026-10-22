import { changedPathsOf } from './changes.ts';
import type { Candidate } from './git-reads.ts';
import { anyGlobMatches } from './globs.ts';
import type { LoadedRules } from './rules.ts';
import type { Reason } from './types.ts';

// Local evidence never proves GitHub check provenance or human approval. The merge gate verifies those separately.
export function evidenceRequirements(candidate: Candidate, rules: LoadedRules) {
  const paths = changedPathsOf(candidate.changes);
  const production = paths.some((path) => anyGlobMatches(rules.base.scopes.production, path));
  const process = rules.base.historical || paths.some((path) => anyGlobMatches(rules.base.processPaths ?? rules.base.scopes.production, path));
  return { production, process };
}

export function evidenceReasons(candidate: Candidate, rules: LoadedRules): Reason[] {
  const { production, process } = evidenceRequirements(candidate, rules);
  const missing = [
    ...(production && candidate.snapshots === undefined ? [{ key: 'evidence.snapshots', fact: 'MI snapshots' }] : []),
    ...(production && candidate.crap === undefined ? [{ key: 'evidence.crap', fact: 'CRAP rows' }] : []),
    ...(process && candidate.metrics === undefined ? [{ key: 'evidence.process', fact: 'metrics process and review' }] : []),
  ];
  return [
    ...missing.map((reason): Reason => ({ blocking: true, ...reason })),
    ...(rules.trusted === false ? [{ blocking: true as const, key: 'policy.untrusted_base', fact: 'No valid trusted base policy is available.' }] : []),
  ];
}
