import { posix } from 'node:path';
import { CommandError } from '../code-quality/shared/command-error.ts';
import { checkBaseRef, parseCommandArguments } from '../code-quality/shared/command-line.ts';
import type { SnapshotPaths } from './snapshots.ts';

export const help = `Usage: node script/pr-review/check.ts [--base REF] [--rules PATH] [--repo OWNER/NAME] [--allow-dirty] [--base-snapshot FILE --head-snapshot FILE] [--json] [--help]

Compute the review route of the pull request candidate: the step "Run the
check" of the section "Review route" of AGENTS.md. The candidate is the commit
HEAD. The check compares it with the merge base of REF and HEAD, with rename
detection, and reads all files from git. A working tree with uncommitted
changes stops the check, unless you give --allow-dirty.

The rules come from PATH at the merge base. If that file does not exist there,
or is not valid, the file at HEAD applies. The rules file at HEAD lists the
facts that the pull request declares. The report gives the route, every
reason, the questions, the changed paths, the line and test counts, the MI
comparison, the facts to declare, the declared facts, the modules to compare,
and the label command. The steps "Declare or remove facts", "Metrics", and
"Decision" stay with you.

With --base-snapshot and --head-snapshot, the check applies the MI rules of
check 4 to the changed production files. Make the two files with
script/code-quality/ast-metrics-snapshot.ts: with --base REF for the merge
base, and without --base for HEAD. The check also reads the exceptions file
.code-quality-exceptions.yaml at HEAD, when it exists.

Options:
  --base REF            Git ref to compare with (default: origin/main)
  --rules PATH          Rules file, relative to the repository root
                        (default: docs/implementation/pr-review-rules.yaml)
  --repo OWNER/NAME     Repository for the printed label command
                        (default: the repository of the current folder)
  --allow-dirty         Check HEAD also when the working tree has uncommitted changes
  --base-snapshot FILE  Snapshot of the merge base, relative to the current folder
  --head-snapshot FILE  Snapshot of HEAD, relative to the current folder
  --json                Print one JSON object instead of Markdown
  --help, -h            Show this help

Exit status 0: the check computed a route, also when the route is FIX.
Exit status 1: an argument is not valid, the working tree is not clean, or the
check could not compute a route, for example because the base ref is missing,
the rules file at HEAD is missing or not valid, a snapshot is not of its
commit, or the exceptions file is not valid.
`;

const shape = {
  base: { type: 'string', default: 'origin/main' },
  rules: { type: 'string', default: 'docs/implementation/pr-review-rules.yaml' },
  repo: { type: 'string' },
  'allow-dirty': { type: 'boolean' },
  'base-snapshot': { type: 'string' },
  'head-snapshot': { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

export interface CheckOptions {
  readonly base: string;
  readonly rules: string;
  readonly repository?: string;
  readonly allowDirty: boolean;
  readonly json: boolean;
  readonly snapshots?: SnapshotPaths;
}

export function optionsOf(args: readonly string[]): CheckOptions | { readonly help: true } {
  const values = parseCommandArguments({ args, options: shape }).values;
  if (values.help) return { help: true };
  checkBaseRef(values.base);
  return {
    base: values.base, rules: rulesPathOf(values.rules), repository: repositoryOf(values.repo),
    allowDirty: values['allow-dirty'] === true, json: values.json === true,
    snapshots: snapshotPathsOf(values['base-snapshot'], values['head-snapshot']),
  };
}

// The rules file is a path of the repository, because the check reads it from git.
function rulesPathOf(value: string): string {
  const path = posix.normalize(value);
  if (value === '' || posix.isAbsolute(path) || path === '..' || path.startsWith('../')) {
    throw new CommandError('The --rules value must name a file of the repository, relative to its root.');
  }
  return path;
}

function repositoryOf(value: string | undefined): string | undefined {
  if (value !== undefined && !/^[\w.-]+\/[\w.-]+$/u.test(value)) throw new CommandError('The --repo value must have the form OWNER/NAME.');
  return value;
}

// One snapshot alone gives no comparison.
function snapshotPathsOf(base: string | undefined, head: string | undefined): SnapshotPaths | undefined {
  if (base === undefined && head === undefined) return undefined;
  if (!base || !head) throw new CommandError('Give both --base-snapshot and --head-snapshot, or neither.');
  return { base, head };
}
