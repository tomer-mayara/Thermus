import { CommandError } from '../code-quality/shared/command-error.ts';
import { blobsAt } from './blobs.ts';
import type { Revisions } from './git-reads.ts';
import { rulesOf, type LoadedRules } from './rules.ts';

// The rules of the merge base apply. When the merge base has no valid rules file, the file at HEAD applies, and the
// change of the rules file is CLARIFICATION_NEEDED. The rules file at HEAD must be valid: it lists the facts that the candidate declares.
export function rulesAt(root: string, revisions: Revisions, path: string): LoadedRules {
  const headText = blobsAt(root, revisions.head, [path]).get(path);
  if (headText === undefined) throw new CommandError(`The rules file ${path} does not exist at HEAD. Commit it, or name another file with --rules.`);
  const head = rulesOf(headText, `The rules file ${path} at HEAD`);
  const baseText = blobsAt(root, revisions.mergeBase, [path]).get(path);
  if (baseText === undefined) return { base: head, head, path, notes: ['The rules file of the merge base does not exist, so the file at HEAD applies.'] };
  try {
    return { base: rulesOf(baseText, `The rules file ${path} at the merge base`, 'merge-base'), head, path, notes: [] };
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    return { base: head, head, path, notes: [`The rules file of the merge base is not valid, so the file at HEAD applies. ${error.message}`] };
  }
}
