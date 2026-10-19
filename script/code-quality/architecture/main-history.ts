import { git } from '../shared/repository.ts';

export type MainHistory =
  | { readonly kind: 'available'; readonly commits: readonly string[] }
  | { readonly kind: 'unavailable'; readonly reason: string };

// Dates do not establish adjacency. Only complete first-parent Git history does.
export function firstParentMainHistory(root: string): MainHistory {
  try {
    const tip = git(root, ['rev-parse', '--verify', 'origin/main^{commit}'], 'Cannot check gaps without origin/main.').trim();
    const shallow = git(root, ['rev-parse', '--is-shallow-repository'], 'Cannot check whether Git history is shallow.').trim();
    if (shallow !== 'false') return { kind: 'unavailable', reason: 'Git history is shallow; omitted commits on origin/main cannot be checked.' };
    const commits = git(root, ['rev-list', '--first-parent', tip], 'Cannot read first-parent origin/main history.').trim().split(/\r?\n/u);
    if (commits.some((commit) => !/^[a-f0-9]{40}$/u.test(commit))) return { kind: 'unavailable', reason: 'First-parent origin/main history has no complete commit identities.' };
    return { kind: 'available', commits };
  } catch (error) {
    return { kind: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
  }
}
