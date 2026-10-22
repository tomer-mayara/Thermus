import { posix } from 'node:path';
import { CommandError } from '../code-quality/shared/command-error.ts';
import { checkBaseRef, parseCommandArguments } from '../code-quality/shared/command-line.ts';
import type { MetricsPaths } from './metrics-files.ts';
import type { SnapshotPaths } from './snapshots.ts';

export const help = `Usage: node script/pr-review/check.ts [--base REF] [--rules PATH] [--repo OWNER/NAME] [--impact FILE] [--allow-dirty] [--base-snapshot FILE --head-snapshot FILE] [--crap FILE] [--process FILE --review FILE] [--json] [--help]

Compute T0 Auto merge, T1 Team review, or T2 Need architect for committed HEAD.
The highest review tier and local eligibility (eligible or blocked) are separate.
All reasons are retained. A failure never hides the required review tier.
The trusted merge-base policy governs; HEAD only declares candidate facts.

--impact is a JSON declaration bound to HEAD and the merge base, with every
classification flag, architecture summary, checked views, and evidence.
Missing impact blocks automatic merge and requires at least T1 Team review.
The trusted policy selects required metrics; missing required files block.
Local eligibility does not prove GitHub checks, holds, or human approvals.

Options:
  --base REF            Comparison ref (default: origin/main)
  --rules PATH          Repository rules (default: docs/implementation/pr-review-rules.yaml)
  --repo OWNER/NAME     Repository for the printed label command
  --impact FILE         Architecture impact JSON for this candidate and merge base
  --allow-dirty         Inspect committed HEAD alone despite uncommitted files
  --base-snapshot FILE  MI snapshot of the merge base (give both snapshots)
  --head-snapshot FILE  MI snapshot of HEAD
  --crap FILE           CRAP rows of HEAD compared with the merge base
  --process FILE        Final metrics stage outcomes (give --review too)
  --review FILE         Final metrics review findings
  --json                Print one JSON object instead of Markdown
  --help, -h            Show this help

Exit 0: classification completed; inspect eligibility and blockers before merge.
Exit 1: an input or tool error prevented classification; repair the diagnostic.
See script/pr-review/README.md for the impact schema and evidence requirements.
`;

const shape = {
  base: { type: 'string', default: 'origin/main' },
  rules: { type: 'string', default: 'docs/implementation/pr-review-rules.yaml' },
  repo: { type: 'string' },
  'allow-dirty': { type: 'boolean' },
  'base-snapshot': { type: 'string' },
  'head-snapshot': { type: 'string' },
  crap: { type: 'string' },
  impact: { type: 'string' },
  process: { type: 'string' },
  review: { type: 'string' },
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
  readonly crap?: string;
  readonly impact?: string;
  readonly metrics?: MetricsPaths;
}

export function optionsOf(args: readonly string[]): CheckOptions | { readonly help: true } {
  const values = parseCommandArguments({ args, options: shape }).values;
  if (values.help) return { help: true };
  checkBaseRef(values.base);
  return {
    base: values.base, rules: rulesPathOf(values.rules), repository: repositoryOf(values.repo),
    allowDirty: values['allow-dirty'] === true, json: values.json === true,
    snapshots: snapshotPathsOf(values['base-snapshot'], values['head-snapshot']), crap: values.crap, impact: values.impact,
    metrics: metricsPathsOf(values.process, values.review),
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

// The stage outcomes alone would leave out the findings of the review, and the findings alone a failed stage.
function metricsPathsOf(outcomes: string | undefined, findings: string | undefined): MetricsPaths | undefined {
  if (outcomes === undefined && findings === undefined) return undefined;
  if (!outcomes || !findings) throw new CommandError('Give both --process and --review, or neither.');
  return { process: outcomes, review: findings };
}
