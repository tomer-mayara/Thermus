#!/usr/bin/env node
import { CommandError, reportCommandError } from '../code-quality/shared/command-error.ts';
import { parseCommandArguments } from '../code-quality/shared/command-line.ts';
import { repositoryRoot } from '../code-quality/shared/repository.ts';
import { evaluationOf, installationOf, type Installation } from './replay-commits.ts';
import { reportFolderOf, textsOf, writeReport, type Report, type Row } from './replay-report.ts';
import { checkGh, namesOf, revisionOf, type Revision, type Target } from './replay-revisions.ts';
import { StageFailure, Workspace } from './replay-workspace.ts';

const help = `Usage: node script/pr-review/replay.ts (--pr N | --pair BASE:HEAD) [...] [--repo OWNER/NAME] [--out DIR] [--json] [--help]

Replay the review tier check on earlier pull requests. The replay uses the
rules and the checker of this working tree. Use it to calibrate the rules or
to verify a change to them. Evaluation only: the result is never evidence for
a candidate. The trusted merge-base policy governs a real candidate.

For each pull request, the replay makes two commits in temporary worktrees.
The base commit is the merge base with the rules file and
tsconfig.api-surface.json of this working tree. It also holds the declaration
snapshots that script/pr-review/api-surface.ts --skip-missing makes again. A
module that the rules list but that does not exist at a commit gets no
snapshot there; a note names it. The head commit is the head of the pull
request with the same files. Its parents are that head and the base commit,
so the check takes the base commit as the merge base. Each commit keeps the
committer date of the commit that it starts from.

Then script/pr-review/check.ts --base <base commit> --json runs in the worktree
of the head commit. When the head of the pull request has .pr-impact.json, the
check also gets --impact with a copy whose base and head are the two commits.
The tier then counts the flags that the agents set. Without that file, or when
it is not a JSON object, the check runs without --impact; a note tells this.
The check does not see a change of the pull request to the installed files; a
note shows such a change. The replay removes its temporary folder, worktrees,
and refs at the end, also after a failure, SIGINT, or SIGTERM. When SIGKILL
stops a run, the next run removes them.

Head and base of a pull request (M is its merge commit):
  merged with a merge commit   head M^2, base M^1
  merged with one commit       head headRefOid, base M^1 (a squash merge)
  open                         head refs/pull/N/head, base origin/<base branch>,
                               or origin/main when the base branch is gone
A pair gives the two refs or commits. The merge base of head and base is the
merge base of the replay.

Options:
  --pr N             A pull request of --repo; needs gh (repeat for more)
  --pair BASE:HEAD   Two refs or commits of this repository (repeat for more)
  --repo OWNER/NAME  Repository of the pull requests (default: tomer-mayara/Thermus)
  --out DIR          Folder for replay.md, replay.json, and check-<N>.json or
                     check-<BASE>-<HEAD>.json (default: ast-report/replay in
                     the repository root)
  --json             Print one JSON object instead of Markdown
  --help, -h         Show this help

Exit 0: each pull request is evaluated or recorded as failed.
Exit 1: a usage error or a tool failure stopped the run.
`;

const shape = {
  pr: { type: 'string', multiple: true },
  pair: { type: 'string', multiple: true },
  repo: { type: 'string', default: 'tomer-mayara/Thermus' },
  out: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

interface ReplayOptions {
  readonly targets: readonly Target[];
  readonly repository: string;
  readonly out?: string;
  readonly json: boolean;
}

const notice = (line: string) => process.stderr.write(`pr-review-replay: ${line}\n`);

async function main(args: readonly string[]): Promise<void> {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return;
  }
  const root = repositoryRoot();
  const installation = installationOf(root);
  const folder = reportFolderOf(root, options.out);
  if (options.targets.some((target) => target.kind === 'pull-request')) checkGh();
  const workspace = new Workspace(root, notice);
  const rows: Row[] = [];
  try {
    for (const target of options.targets) {
      const row = await rowOf(workspace, { target, repository: options.repository }, installation);
      notice(progressOf(row));
      rows.push(row);
    }
  } finally {
    workspace.close();
  }
  const report: Report = { evaluatedRules: installation.rulesHead, uncommittedChanges: installation.uncommitted, rows };
  const texts = textsOf(report);
  process.stdout.write(options.json ? texts.json : texts.markdown);
  writeReport(folder, report, texts);
}

// The targets keep the order of the command line.
function optionsOf(args: readonly string[]): ReplayOptions | { readonly help: true } {
  const { values, tokens } = parseCommandArguments({ args, options: shape, tokens: true });
  if (values.help) return { help: true };
  const targets = tokens.flatMap((token) => (token.kind === 'option' ? targetsOf(token.name, token.value ?? '') : []));
  if (targets.length === 0) throw new CommandError('Give at least one --pr or --pair. Use --help for the options.');
  if (!/^[\w.-]+\/[\w.-]+$/u.test(values.repo)) throw new CommandError('The --repo value must have the form OWNER/NAME.');
  if (values.out === '') throw new CommandError('The --out value must name a folder.');
  return { targets, repository: values.repo, out: values.out, json: values.json === true };
}

function targetsOf(name: string, value: string): Target[] {
  if (name === 'pr') {
    if (!/^[1-9]\d{0,8}$/u.test(value)) throw new CommandError(`The --pr value ${value} is not a pull request number.`);
    return [{ kind: 'pull-request', number: Number(value) }];
  }
  if (name !== 'pair') return [];
  // git takes a ref that starts with a dash as an option.
  const match = /^([^:-][^:]*):([^:-][^:]*)$/u.exec(value);
  if (match === null) throw new CommandError(`The --pair value ${value} must have the form BASE:HEAD, with two refs or commits.`);
  return [{ kind: 'pair', base: match[1], head: match[2] }];
}

async function rowOf(workspace: Workspace, request: { readonly target: Target; readonly repository: string }, installation: Installation): Promise<Row> {
  const start: Row = { ...namesOf(request.target), notes: [] };
  let revision: Revision;
  try {
    revision = await revisionOf(workspace, request.target, request.repository);
  } catch (error) {
    return failedRow(start, error);
  }
  const found: Row = { ...start, ...revision };
  try {
    const evaluation = await evaluationOf(workspace, installation, revision);
    return { ...found, ...evaluation, notes: [...revision.notes, ...evaluation.notes] };
  } catch (error) {
    return failedRow(found, error);
  }
}

// Only the failure of a step stays in the report. Another error stops the run.
function failedRow(row: Row, error: unknown): Row {
  if (!(error instanceof StageFailure)) throw error;
  return { ...row, failure: { stage: error.stage, message: error.message } };
}

function progressOf(row: Row): string {
  return `${row.label}: ${row.result === undefined ? `${row.failure?.stage} failed` : `${row.result.tierName}, ${row.result.eligibility}`}`;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  reportCommandError('pr-review-replay', error);
});
