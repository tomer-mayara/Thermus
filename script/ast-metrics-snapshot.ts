#!/usr/bin/env node
import { resolve } from 'node:path';
import { snapshotOfBase } from './ast-metrics-snapshot-base.ts';
import { commandOf } from './ast-metrics-snapshot-command-line.ts';
import { writeSnapshotFile } from './ast-metrics-snapshot-file.ts';
import { snapshotOfTree } from './ast-metrics-snapshot-tree.ts';
import { CommandError, repositoryRoot } from './repository.ts';

const help = `Usage: node script/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS] [--help]

Write the snapshot of the working tree: the numbers of ast-metrics for the files
under src/ and for their communities, in one JSON file. In the repository root,
the command runs ast-metrics analyze src for the JSON report, then one session
of the MCP server (ast-metrics mcp src) with get_communities and
get_file_metrics for each src/ file. Both analyze src/ alone, so that code
outside src/ cannot regroup its communities. The snapshot names the commit and
the date of HEAD; the files can hold changes that are not committed.

With --base, the snapshot is of the merge base of REF and HEAD: the command adds
a temporary worktree of that commit in the system temporary folder, runs the
same analysis there, and removes the worktree again, also after a failure. The
snapshot then names the merge base and its date.

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root, or
                   ast-report/snapshot-base.json with --base)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --help, -h       Show this help

Exit status 0: the snapshot is written. Exit status 1: the command failed. It
prints one diagnostic line on stderr and writes no snapshot.
`;

// The snapshot of the merge base has a file of its own, so that it does not replace the snapshot of the working tree.
const defaultFiles = { tree: 'ast-report/snapshot.json', base: 'ast-report/snapshot-base.json' };

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const root = repositoryRoot();
  const snapshot = command.base === undefined ? await snapshotOfTree(root, command.timeoutMs) : await snapshotOfBase(root, command.base, command.timeoutMs);
  const defaultFile = command.base === undefined ? defaultFiles.tree : defaultFiles.base;
  const target = command.out === undefined ? resolve(root, defaultFile) : resolve(command.out);
  writeSnapshotFile(target, snapshot);
  const counts = [
    plural(snapshot.communities.length, 'community', 'communities'),
    plural(snapshot.global.files, 'file', 'files'),
    plural(snapshot.global.functions, 'function', 'functions'),
  ];
  return `Wrote ${command.out ?? defaultFile}: ${counts.join(', ')}.\n`;
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
