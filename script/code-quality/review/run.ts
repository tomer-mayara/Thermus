import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';
import * as repository from '../shared/repository.ts';
import type { StageReport } from '../shared/report.ts';
import { cliToolVersion } from '../shared/tool-version.ts';
import { reviewPassed } from './report.ts';

export interface ReviewOptions {
  readonly base: string;
  readonly maxFindings?: number;
  readonly allowToolVersion: boolean;
}

const markdownPath = './ast-report/review.md';
const jsonPath = './ast-report/review.json';

function freshReports(root: string): void {
  fs.mkdirSync(join(root, 'ast-report'), { recursive: true });
  for (const path of [markdownPath, jsonPath]) fs.rmSync(join(root, path), { force: true });
}

function reportText(root: string, path: string): string {
  try { return fs.readFileSync(join(root, path), 'utf8'); }
  catch { throw new repository.CommandError(`ast-metrics review wrote no ${path}.`); }
}

function collectReview(root: string, options: ReviewOptions): StageReport {
  freshReports(root);
  const args = ['review', '--base', options.base, '--format', 'markdown', '--max-findings', String(options.maxFindings ?? 50), '--report-markdown', markdownPath, '--report-json', jsonPath, '--fail-on', 'high'];
  const run = spawnSync('ast-metrics', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  if (run.error) {
    const { code, message } = run.error as NodeJS.ErrnoException;
    throw new repository.CommandError(code === 'ENOENT' ? repository.notInstalled : `ast-metrics did not run: ${message}`);
  }
  if (run.status === null) throw new repository.CommandError(`ast-metrics review stopped on signal ${run.signal}.`);
  const text = reportText(root, markdownPath);
  const passed = reviewPassed(reportText(root, jsonPath), { base: options.base, status: run.status });
  if (text !== run.stdout) throw new repository.CommandError('ast-metrics review wrote inconsistent Markdown.');
  return { text, passed };
}

export function runReview(root: string, options: ReviewOptions): StageReport {
  repository.verifyBase(root, options.base);
  cliToolVersion(root, options.allowToolVersion);
  if (!fs.existsSync(join(root, '.ast-metrics-baseline.yaml'))) process.stderr.write('ast-metrics-review: no .ast-metrics-baseline.yaml; every existing rule violation counts as new.\n');
  return collectReview(root, options);
}
