#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CommandError, reportFailure } from './shared/command-error.ts';
import { astMetricsBinary, fileSha256, patchPath, pinnedGoVersion, pinnedToolVersion, runtimeBinary, runtimeDirectory, sourceArchiveSha256, toolRoot, upstreamCommit } from './shared/tool-runtime.ts';
import { verifyNativeRuntime } from './installation/verify.ts';

const help = `Usage: node script/code-quality/ast-metrics-install.ts [--help]

Build the pinned patched ast-metrics in the ignored local .cache folder.
Requires Git, tar, ${pinnedGoVersion}, a C compiler, and network access.
Set GO_BIN to the Go executable if it is not on PATH.
An intact installation is reused without downloads or build tools.
`;

function run(commandLine: readonly [string, ...string[]], cwd: string, env = process.env): string {
  const [command, ...args] = commandLine;
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new CommandError(`${command} ${args[0]} failed: ${result.error?.message ?? (result.stderr.trim() || `exit status ${result.status}`)}`);
  }
  return result.stdout;
}

function verifyVersion(binary: string): void {
  const actual = /^\s*Current version\s+(\S+)\s*$/mu.exec(run([binary, 'version'], toolRoot))?.[1];
  if (actual !== pinnedToolVersion) throw new CommandError(`Built ast-metrics version ${actual ?? 'unknown'} differs from ${pinnedToolVersion}.`);
}

async function downloadSource(path: string): Promise<void> {
  const url = `https://codeload.github.com/ast-metrics/ast-metrics/tar.gz/${upstreamCommit}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: 'error' });
  if (!response.ok) throw new CommandError(`Source download failed: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sourceArchiveSha256) {
    throw new CommandError('The source archive SHA256 does not match the pinned value. No source was extracted.');
  }
  writeFileSync(path, bytes);
}

function goBuildEnvironment(workspace: string) {
  const go = process.env.GO_BIN || 'go';
  const env = {
    ...process.env, GOENV: 'off', GOTOOLCHAIN: 'local', GOWORK: 'off', GOFLAGS: '', GOROOT: undefined,
    GOOS: process.platform === 'darwin' ? 'darwin' : 'linux', GOARCH: process.arch === 'x64' ? 'amd64' : 'arm64',
    CGO_ENABLED: '1', GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org',
    GOPRIVATE: '', GONOPROXY: '', GONOSUMDB: '', GOPATH: join(workspace, 'go'),
    GOMODCACHE: join(workspace, 'go/pkg/mod'), GOCACHE: join(workspace, 'go-build'),
  };
  const version = /^go version (\S+)/u.exec(run([go, 'version'], toolRoot, env))?.[1];
  if (version !== pinnedGoVersion) throw new CommandError(`Go ${version ?? 'unknown'} differs from required ${pinnedGoVersion}. Set GO_BIN to that executable.`);
  return { go, env };
}

function applyPatch(source: string, patch: string): void {
  // An extracted tree under .cache must not discover the enclosing Thermus repository.
  run(['git', 'init', '--quiet'], source);
  run(['git', 'apply', '--check', patch], source);
  run(['git', 'apply', patch], source);
  run(['git', 'apply', '--reverse', '--check', patch], source);
}

function build(source: string, target: string, environment: ReturnType<typeof goBuildEnvironment>): void {
  const { go, env } = environment;
  run([go, 'mod', 'download'], source, env);
  run([go, 'mod', 'verify'], source, env);
  const ldflags = `-s -w -X main.version=${pinnedToolVersion} -X main.commit=${upstreamCommit} -X main.date=2026-10-22T00:00:00Z`;
  run([go, 'build', '-mod=readonly', '-trimpath', '-buildvcs=false', '-ldflags', ldflags, '-o', target, './cmd/ast-metrics'], source, env);
}

function removeWorkspace(path: string): void {
  // Go makes module-cache directories read-only. Restore directory write access before removal.
  chmodSync(path, 0o700);
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) removeWorkspace(join(path, entry.name));
  }
  rmSync(path, { recursive: true, force: true });
}

async function install(): Promise<void> {
  try {
    const binary = astMetricsBinary();
    verifyVersion(binary);
    process.stdout.write(`Reused ${binary}\n`);
    return;
  } catch {
    // A missing, stale, or damaged runtime needs a complete verified build.
  }
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new CommandError('This installer supports macOS and Linux.');
  if (process.arch !== 'x64' && process.arch !== 'arm64') throw new CommandError('This installer supports x64 and arm64.');
  const parent = dirname(runtimeDirectory);
  mkdirSync(parent, { recursive: true });
  const lock = `${runtimeDirectory}.lock`;
  try { mkdirSync(lock); }
  catch (error) {
    throw new CommandError(`Cannot acquire the install lock ${lock}. If no installer is active, remove the lock and retry. ${(error as Error).message}`);
  }
  let workspace: string | undefined;
  try {
    workspace = mkdtempSync(join(parent, '.install-'));
    const environment = goBuildEnvironment(workspace);
    const patch = join(workspace, 'repair.patch');
    copyFileSync(patchPath, patch);
    const patchSha256 = fileSha256(patch);
    const archive = join(workspace, 'source.tar.gz');
    process.stdout.write(`Building ast-metrics ${pinnedToolVersion} from ${upstreamCommit}.\n`);
    await downloadSource(archive);
    const source = join(workspace, 'source');
    mkdirSync(source);
    run(['tar', '-xzf', archive, '--strip-components=1', '-C', source], workspace);
    const staged = join(workspace, 'runtime');
    mkdirSync(staged);
    const binary = join(staged, 'ast-metrics');
    applyPatch(source, patch);
    build(source, binary, environment);
    verifyVersion(binary);
    await verifyNativeRuntime(binary, workspace);
    copyFileSync(join(toolRoot, 'patches/ast-metrics/LICENSE.txt'), join(staged, 'LICENSE.txt'));
    writeFileSync(join(staged, 'install.json'), `${JSON.stringify({ format: 1, version: pinnedToolVersion, upstreamCommit, sourceArchiveSha256, goVersion: pinnedGoVersion, patchSha256, binarySha256: fileSha256(binary) }, null, 2)}\n`);
    if (fileSha256(patchPath) !== patchSha256) throw new CommandError('The repository patch changed during the build. Run the installer again.');
    // Publish only a complete verified runtime. A failed build leaves the old directory intact.
    if (existsSync(runtimeDirectory)) rmSync(runtimeDirectory, { recursive: true });
    renameSync(staged, runtimeDirectory);
    astMetricsBinary();
    process.stdout.write(`Installed ${runtimeBinary}\n`);
  } finally {
    try { if (workspace !== undefined) removeWorkspace(workspace); }
    finally { rmSync(lock, { recursive: true, force: true }); }
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) process.stdout.write(help);
  else if (args.length !== 0) throw new CommandError('Unknown argument. Use --help.');
  else await install();
} catch (error) {
  reportFailure('ast-metrics-install', error);
}
