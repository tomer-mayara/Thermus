import { CommandError } from '../code-quality/shared/command-error.ts';
import { blobsAt } from './blobs.ts';
import type { Revisions } from './git-reads.ts';
import { rulesOf, type LoadedRules } from './rules.ts';

// The rules of the merge base apply. Without valid base rules, eligibility stays blocked and HEAD supplies only
// the declared facts for the report. HEAD must use a valid current schema.
export function rulesAt(root: string, revisions: Revisions, path: string): LoadedRules {
  const headText = blobsAt(root, revisions.head, [path]).get(path);
  if (headText === undefined) throw new CommandError(`The rules file ${path} does not exist at HEAD. Commit it, or name another file with --rules.`);
  const head = rulesOf(headText, `The rules file ${path} at HEAD`);
  const baseText = blobsAt(root, revisions.mergeBase, [path]).get(path);
  if (baseText === undefined) return { base: head, head, path, trusted: false, notes: ['The rules file of the merge base does not exist, so the candidate is blocked; HEAD is read only to report its declared facts.'] };
  try {
    return { base: rulesOf(baseText, `The rules file ${path} at the merge base`, 'merge-base'), head, path, notes: [] };
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    return { base: head, head, path, trusted: false, notes: [`The rules file of the merge base is not valid, so the candidate is blocked; HEAD is read only to report its declared facts. ${error.message}`] };
  }
}
