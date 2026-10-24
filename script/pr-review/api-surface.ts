#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync, type Dirent } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CommandError, reportCommandError } from '../code-quality/shared/command-error.ts';
import { parseCommandArguments } from '../code-quality/shared/command-line.ts';
import { textOrder } from '../code-quality/shared/order.ts';
import { repositoryRoot } from '../code-quality/shared/repository.ts';
import { declarationProject, emitDeclarations, ignoredNote, snapshotPathOf } from './declaration-emit.ts';
import { rulesOf } from './rules.ts';

const help = `Usage: node script/pr-review/api-surface.ts [--check] [--skip-missing] [--rules PATH] [--help]

Write the declaration snapshot of each module that public_surface lists.
The installed TypeScript compiler emits the declarations of src/ with
${declarationProject}. The snapshot of src/a/b.ts is <folder>/src/a/b.d.ts,
where public_surface.snapshots names the folder. The bytes stay as emitted.
The command deletes each declaration file under the folder that no listed
module owns. When the folder holds a file of a different type, the command
stops and writes nothing.

A compiler error in a listed module stops the command, because its snapshot
can be incomplete. Errors in other files are counted on stderr and ignored.
Commit the snapshots with the change. pr-review-check regenerates them at
HEAD, blocks a stale, missing, or orphan snapshot, and compares them with the
snapshots of the merge base.

Options:
  --check        Write nothing; list each stale, missing, and orphan file
  --skip-missing Leave out each listed module that does not exist in this
                 working tree, and name it on stderr. For a replay of an earlier
                 revision; the check at HEAD still needs every snapshot.
  --rules PATH   Rules file of the working tree, relative to the repository
                 root (default: docs/implementation/pr-review-rules.yaml)
  --help, -h     Show this help

Exit 0: the snapshots are written, or with --check all snapshots are current.
Exit 1: with --check, a file is stale, missing, or orphan; or an input or
tool error stopped the command; repair the diagnostic.
`;

const shape = {
  check: { type: 'boolean' },
  'skip-missing': { type: 'boolean' },
  rules: { type: 'string', default: 'docs/implementation/pr-review-rules.yaml' },
  help: { type: 'boolean', short: 'h' },
} as const;

// The command deletes no other file, so that an incorrect folder in the rules cannot delete a document.
const declarationFile = /\.d\.[cm]?ts$/u;

type Entry =
  | { readonly path: string; readonly state: 'current' | 'stale' | 'missing'; readonly text: string }
  | { readonly path: string; readonly state: 'orphan' };

function main(args: readonly string[]): void {
  const { values } = parseCommandArguments({ args, options: shape });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  const root = repositoryRoot();
  const { folder, entries } = entriesOf(root, values.rules, values['skip-missing'] === true);
  if (values.check) checkSnapshots(folder, entries);
  else writeSnapshots(root, folder, entries);
}

function entriesOf(root: string, rulesPath: string, skipMissing: boolean): { readonly folder: string; readonly entries: readonly Entry[] } {
  const rules = rulesOf(rulesText(root, rulesPath), `The rules file ${rulesPath}`);
  const folder = rules.surface.snapshots;
  if (folder === undefined) throw new CommandError(`The rules file ${rulesPath} has no key public_surface.snapshots, so the snapshots have no folder.`);
  const declarations = emitDeclarations(root, rules.surface.modules, { skipMissing });
  const note = ignoredNote(declarations.ignored);
  if (note !== undefined) process.stderr.write(`api-surface: ${note}\n`);
  if (declarations.skipped.length > 0) process.stderr.write(`api-surface: skipped ${declarations.skipped.length} listed modules that do not exist here: ${declarations.skipped.join(', ')}\n`);
  const expected = new Map([...declarations.texts].map(([module, text]) => [snapshotPathOf(folder, module), text]));
  const present = filesUnder(root, folder);
  const entries: Entry[] = [
    ...[...expected].map(([path, text]): Entry => ({ path, text, state: stateOf(join(root, path), text, present.has(path)) })),
    ...[...present].filter((path) => !expected.has(path)).map((path): Entry => ({ path, state: 'orphan' })),
  ];
  return { folder, entries: entries.sort((first, second) => textOrder(first.path, second.path)) };
}

function rulesText(root: string, path: string): string {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    throw new CommandError(`Cannot read the rules file ${path}. Give a file of the working tree, relative to the repository root.`);
  }
}

function filesUnder(root: string, folder: string): Set<string> {
  let entries: Dirent[];
  try {
    entries = readdirSync(join(root, folder), { recursive: true, withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw new CommandError(`Cannot list the snapshot folder ${folder}: ${(error as Error).message}`);
  }
  return new Set(entries.filter((entry) => !entry.isDirectory()).map((entry) => relative(root, join(entry.parentPath, entry.name))));
}

function stateOf(target: string, text: string, present: boolean): 'current' | 'stale' | 'missing' {
  if (!present) return 'missing';
  return readFileSync(target, 'utf8') === text ? 'current' : 'stale';
}

function checkSnapshots(folder: string, entries: readonly Entry[]): void {
  const failed = entries.filter((entry) => entry.state !== 'current');
  for (const entry of failed) process.stdout.write(`${entry.state.padEnd(7)} ${entry.path}\n`);
  if (failed.length === 0) {
    process.stdout.write(`${folder}: the ${entries.length} snapshots are current\n`);
    return;
  }
  process.stdout.write(`${folder}: ${tally(failed, ['stale', 'missing', 'orphan'])}; run node script/pr-review/api-surface.ts and commit\n`);
  process.exitCode = 1;
}

function writeSnapshots(root: string, folder: string, entries: readonly Entry[]): void {
  const foreign = entries.filter((entry) => entry.state === 'orphan' && !declarationFile.test(entry.path)).map((entry) => entry.path);
  if (foreign.length > 0) throw new CommandError(`The snapshot folder ${folder} holds files that are not declaration files: ${foreign.join(', ')}. Move them; the command deletes declaration files only.`);
  const done = entries.map((entry) => ({ path: entry.path, state: applied(root, folder, entry) }));
  for (const entry of done) process.stdout.write(`${entry.state.padEnd(9)} ${entry.path}\n`);
  process.stdout.write(`${folder}: ${tally(done, ['written', 'unchanged', 'deleted'])}\n`);
}

function applied(root: string, folder: string, entry: Entry): 'written' | 'unchanged' | 'deleted' {
  const target = join(root, entry.path);
  if (entry.state === 'orphan') {
    rmSync(target);
    removeEmptyFolders(root, folder, entry.path);
    return 'deleted';
  }
  if (entry.state === 'current') return 'unchanged';
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, entry.text);
  return 'written';
}

// git keeps no empty folder, so a folder that a deleted file leaves empty goes too.
function removeEmptyFolders(root: string, folder: string, path: string): void {
  for (let parent = dirname(path); parent.startsWith(`${folder}/`); parent = dirname(parent)) {
    const target = join(root, parent);
    if (readdirSync(target).length > 0) return;
    rmdirSync(target);
  }
}

function tally(entries: readonly { readonly state: string }[], states: readonly string[]): string {
  return states.map((state) => `${entries.filter((entry) => entry.state === state).length} ${state}`).join(', ');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  reportCommandError('api-surface', error);
}
