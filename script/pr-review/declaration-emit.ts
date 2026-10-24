import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, posix, relative } from 'node:path';
import { CommandError } from '../code-quality/shared/command-error.ts';
import { outputLimit } from '../code-quality/shared/subprocess.ts';

// Its rootDir is the repository root, so the declaration of src/a/b.ts is <outDir>/src/a/b.d.ts.
export const declarationProject = 'tsconfig.api-surface.json';
const compiler = 'node_modules/typescript/bin/tsc';
const compileTimeout = 120_000;
// With --pretty false, the compiler writes one line for each error. The details of an error are on indented lines.
const fileError = /^(.+?)\(\d+,\d+\): error TS\d+: /u;
const optionsError = /^error TS\d+: /u;

// skipped: the listed modules that do not exist in the working tree, when the caller allows that.
interface Declarations {
  readonly texts: ReadonlyMap<string, string>;
  readonly ignored: { readonly errors: number; readonly files: number };
  readonly skipped: readonly string[];
}

// skipMissing: a replay of an earlier revision lists modules that did not exist yet; they get no snapshot there.
export interface EmitOptions {
  readonly skipMissing?: boolean;
}

// An error of the compiler options names no file.
interface CompilerError {
  readonly file?: string;
  readonly line: string;
}

// b.ts and b.tsx give b.d.ts, b.mts gives b.d.mts, and b.cts gives b.d.cts, as the compiler names them.
export function snapshotPathOf(folder: string, module: string): string {
  return `${folder}/${declarationPathOf(module)}`;
}

// The compiler reads the working tree, not a commit.
export function emitDeclarations(root: string, modules: readonly string[], options: EmitOptions = {}): Declarations {
  const declarationPaths = new Map(modules.map((module) => [module, declarationPathOf(module)]));
  const outDir = mkdtempSync(join(tmpdir(), 'api-surface-'));
  try {
    const errors = compilerErrors(root, outDir);
    checkErrors(errors, modules);
    return { ...emittedTexts(outDir, declarationPaths, options.skipMissing === true), ignored: { errors: errors.length, files: new Set(errors.map((error) => error.file)).size } };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

export function ignoredNote(ignored: Declarations['ignored']): string | undefined {
  if (ignored.errors === 0) return undefined;
  return `ignored ${counted(ignored.errors, 'compiler error')} in ${counted(ignored.files, 'file')} that public_surface does not list`;
}

function declarationPathOf(module: string): string {
  const match = /^(.+)\.(ts|tsx|mts|cts)$/u.exec(module);
  if (match === null) throw new CommandError(`${module} of public_surface is not a TypeScript module, so it has no declaration snapshot.`);
  return `${match[1]}.d.${match[2] === 'tsx' ? 'ts' : match[2]}`;
}

function compilerErrors(root: string, outDir: string): CompilerError[] {
  if (!existsSync(join(root, compiler))) throw new CommandError(`The TypeScript compiler ${compiler} is not installed. Run pnpm install.`);
  if (!existsSync(join(root, declarationProject))) throw new CommandError(`${declarationProject} does not exist at the repository root, so the declarations cannot be emitted.`);
  const run = spawnSync(process.execPath, [join(root, compiler), '--project', declarationProject, '--outDir', outDir, '--pretty', 'false'], { cwd: root, encoding: 'utf8', maxBuffer: outputLimit, timeout: compileTimeout });
  if (run.error) throw new CommandError(`The TypeScript compiler did not finish: ${run.error.message}`);
  const errors = run.stdout.split('\n').flatMap((line) => errorOf(root, line));
  if (run.status !== 0 && errors.length === 0) {
    const detail = (run.stderr || run.stdout).trim().split('\n')[0];
    throw new CommandError(`The TypeScript compiler stopped with exit status ${run.status ?? run.signal} and no error line. ${detail}`.trim());
  }
  return errors;
}

function errorOf(root: string, line: string): CompilerError[] {
  const inFile = fileError.exec(line);
  if (inFile !== null) return [{ file: isAbsolute(inFile[1]) ? relative(root, inFile[1]) : posix.normalize(inFile[1]), line }];
  return optionsError.test(line) ? [{ line }] : [];
}

// An error in a listed module can remove a declaration from its snapshot. An error without a file, or in a JSON file,
// is an error of the compiler options, and then no snapshot is reliable.
function checkErrors(errors: readonly CompilerError[], modules: readonly string[]): void {
  const listed = new Set(modules);
  const stopping = errors.filter((error) => error.file === undefined || error.file.endsWith('.json') || listed.has(error.file));
  if (stopping.length === 0) return;
  const named = [...new Set(stopping.map((error) => error.file ?? 'the compiler options'))];
  throw new CommandError(`The TypeScript compiler reported errors in ${named.join(', ')}, so the declaration snapshots can be incomplete. ${stopping[0].line}`);
}

function emittedTexts(outDir: string, declarationPaths: ReadonlyMap<string, string>, skipMissing: boolean): Pick<Declarations, 'texts' | 'skipped'> {
  const missing = [...declarationPaths].filter(([, path]) => !existsSync(join(outDir, path))).map(([module]) => module);
  if (missing.length > 0 && !skipMissing) throw new CommandError(`The TypeScript compiler emitted no declarations for ${missing.join(', ')}. Make sure that each module exists and that ${declarationProject} includes it.`);
  const present = [...declarationPaths].filter(([module]) => !missing.includes(module));
  return { texts: new Map(present.map(([module, path]) => [module, readFileSync(join(outDir, path), 'utf8')])), skipped: missing };
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
