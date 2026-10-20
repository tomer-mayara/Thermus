#!/usr/bin/env node
import * as fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { reportFailure } from './shared/command-error.ts';
import { cliToolVersion } from './shared/tool-version.ts';
import { snapshotOfBase } from './snapshot/base.ts';
import { commandOf } from './snapshot/command-line.ts';
import { snapshotOfCommit } from './snapshot/commit.ts';
import { snapshotOfTree } from './snapshot/tree.ts';
import type { Snapshot } from './snapshot/types.ts';
import * as repository from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-snapshot.ts [--base REF | --commit FULL_SHA] [--out FILE] [--timeout-ms MS] [--allow-tool-version] [--help]

Write the snapshot of the working tree: the numbers of ast-metrics for the files
under src/ and for their communities, in one JSON file. In the repository root,
the command runs ast-metrics analyze src for the JSON report, then one session
of the MCP server (ast-metrics mcp src) with get_communities and
get_file_metrics for each src/ file. Both analyze src/ alone, so that code
outside src/ cannot regroup its communities. The snapshot names the commit and
the date of HEAD; the files can hold changes that are not committed. It also
records the source and expected coverage input fingerprints, suite, measurement
version, runtime, and compiler. Inputs must stay the same during capture; a
change stops publication.

With --base, the snapshot is of the merge base of REF and HEAD: the command adds
a temporary worktree of that commit in the system temporary folder, with no hook
of the repository, runs the same analysis there, and removes the worktree
again, also after a failure, SIGINT, or SIGTERM. The snapshot then names the
merge base and its date. First, the command removes the temporary worktrees that
interrupted runs left, and says on stderr how many it removed.

With --commit, the snapshot is of the exact requested commit, with the same
temporary worktree cleanup. The value must be a full lowercase 40-character
commit SHA. Use only one of --base and --commit. Neither option installs
dependencies, builds the project, or collects coverage.

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --commit FULL_SHA  Take the snapshot of one full lowercase 40-character commit SHA
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root,
                   ast-report/snapshot-base.json with --base, or
                   ast-report/snapshot-commit.json with --commit)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h       Show this help

Exit status 0: the snapshot is written. Exit status 1: the command failed. It
prints one diagnostic line on stderr and writes no snapshot. Exit status 130 or
143: SIGINT or SIGTERM stopped the snapshot of the merge base or exact commit,
after the removal of its worktree.
`;

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  fs.writeSync(process.stderr.fd, `ast-metrics-snapshot: ${line}\n`);
}

const defaultFiles = { tree: 'ast-report/snapshot.json', base: 'ast-report/snapshot-base.json', commit: 'ast-report/snapshot-commit.json' };

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const root = repository.repositoryRoot();
  const { base, commit, timeoutMs } = command;
  if (base !== undefined) repository.verifyBase(root, base);
  const snapshot = commit !== undefined
    ? await snapshotOfCommit({ root, commit, timeoutMs, notice, allowToolVersion: command.allowToolVersion })
    : base === undefined
      ? await snapshotOfTree(root, timeoutMs, cliToolVersion(root, command.allowToolVersion))
      : await snapshotOfBase({ root, ref: base, timeoutMs, notice, allowToolVersion: command.allowToolVersion });
  const defaultFile = commit !== undefined ? defaultFiles.commit : base === undefined ? defaultFiles.tree : defaultFiles.base;
  const target = command.out === undefined ? resolve(root, defaultFile) : resolve(command.out);
  writeSnapshotFile(target, snapshot);
  const counts = [
    plural(snapshot.communities.length, 'community', 'communities'),
    plural(snapshot.global.files, 'file', 'files'),
    plural(snapshot.global.functions, 'function', 'functions'),
  ];
  return `Wrote ${command.out ?? defaultFile}: ${counts.join(', ')}.\n`;
}

// The file is complete or absent: the text goes to a temporary file next to it, and a rename replaces the file in one
// step.
function writeSnapshotFile(path: string, snapshot: Snapshot): void {
  fs.mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
    fs.renameSync(temporary, path);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

try {
  process.stdout.write(await main());
} catch (error) {
  reportFailure('ast-metrics-snapshot', error);
}
