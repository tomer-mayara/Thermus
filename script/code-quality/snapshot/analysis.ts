import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommandError, notInstalled } from '../shared/repository.ts';

const outputLimit = 64 * 1024 * 1024;
const diagnosticStderrLimit = 2_000;

// The analyzed folder is a path from the root, such as src. The JSON report goes to a new temporary folder, so that
// the report of an earlier run cannot stand in for it.
export function analysisReportOf(root: string, analyzed: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'thermus-ast-metrics-snapshot-'));
  try {
    const report = join(folder, 'report.json');
    analyze(root, analyzed, report);
    return readReport(report);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function analyze(root: string, analyzed: string, report: string): void {
  // A Go program such as ast-metrics takes its working directory from PWD when PWD names that folder. Without the root
  // in PWD, a caller that came through a symbolic link gets paths through the link, and no path is in the root.
  const run = spawnSync('ast-metrics', ['analyze', `--report-json=${report}`, '--report-summary=false', analyzed], {
    cwd: root, env: { ...process.env, PWD: root }, encoding: 'utf8', maxBuffer: outputLimit, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (run.error) {
    const { code, message } = run.error as NodeJS.ErrnoException;
    throw new CommandError(code === 'ENOENT' ? notInstalled : `ast-metrics did not run: ${message}`);
  }
  if (run.status === 0) return;
  // The list of reports on stdout is noise. ast-metrics writes the cause of a failure to stderr.
  const outcome = run.status === null ? `stopped on signal ${run.signal}` : `failed with exit status ${run.status}`;
  throw new CommandError(`ast-metrics analyze ${outcome}. ${stderrNote(run.stderr)}`);
}

function readReport(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CommandError('ast-metrics analyze wrote no JSON report.');
  }
}

function stderrNote(stderr: string): string {
  const text = stderr.trim().slice(0, diagnosticStderrLimit);
  return text === '' ? 'It wrote nothing to stderr.' : `Its stderr: ${text}`;
}
