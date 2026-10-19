#!/usr/bin/env node
import { mkdirSync, renameSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { snapshotOfBase } from './snapshot/base.ts';
import { commandOf } from './snapshot/command-line.ts';
import { snapshotOfTree } from './snapshot/tree.ts';
import type { Snapshot } from './snapshot/types.ts';
import { CommandError, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS] [--help]

Write the snapshot of the working tree: the numbers of ast-metrics for the files
under src/ and for their communities, in one JSON file. In the repository root,
the command runs ast-metrics analyze src for the JSON report, then one session
of the MCP server (ast-metrics mcp src) with get_communities and
get_file_metrics for each src/ file. Both analyze src/ alone, so that code
outside src/ cannot regroup its communities. The snapshot names the commit and
the date of HEAD; the files can hold changes that are not committed.

With --base, the snapshot is of the merge base of REF and HEAD: the command adds
a temporary worktree of that commit in the system temporary folder, with no hook
of the repository, runs the same analysis there, and removes the worktree
again, also after a failure, SIGINT, or SIGTERM. The snapshot then names the
merge base and its date. First, the command removes the temporary worktrees that
interrupted runs left, and says on stderr how many it removed.

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root, or
                   ast-report/snapshot-base.json with --base)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --help, -h       Show this help

Exit status 0: the snapshot is written. Exit status 1: the command failed. It
prints one diagnostic line on stderr and writes no snapshot. Exit status 130 or
143: SIGINT or SIGTERM stopped the snapshot of the merge base, after the removal
of its worktree.
`;

// The line goes out at once, because a signal ends the process right after it.
function notice(line: string): void {
  writeSync(process.stderr.fd, `ast-metrics-snapshot: ${line}\n`);
}

// The snapshot of the merge base has a file of its own, so that it does not replace the snapshot of the working tree.
const defaultFiles = { tree: 'ast-report/snapshot.json', base: 'ast-report/snapshot-base.json' };

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const root = repositoryRoot();
  const { base, timeoutMs } = command;
  const snapshot = base === undefined ? await snapshotOfTree(root, timeoutMs) : await snapshotOfBase({ root, ref: base, timeoutMs, notice });
  const defaultFile = base === undefined ? defaultFiles.tree : defaultFiles.base;
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
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

try {
  process.stdout.write(await main());
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic is one line, also when ast-metrics or the server wrote several lines.
  process.stderr.write(`ast-metrics-snapshot: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
