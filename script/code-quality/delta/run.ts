import { cliToolVersion } from '../shared/tool-version.ts';
import { verifyBase } from '../shared/repository.ts';
import type { StageReport } from '../shared/report.ts';
import { analyzeDelta, reportFolder } from './analysis.ts';
import { deltaFiles } from './files.ts';
import { deltaReportOf } from './report.ts';

export interface DeltaOptions {
  readonly base: string;
  readonly min?: number;
  readonly compare?: boolean;
  readonly allowToolVersion: boolean;
}

export function runDelta(root: string, options: DeltaOptions): StageReport {
  verifyBase(root, options.base);
  const files = deltaFiles(root, options.base);
  if (files.length === 0) return { text: `No TypeScript file is added or changed against ${options.base}.\n`, passed: true };
  cliToolVersion(root, options.allowToolVersion);
  const min = options.min ?? 85, compare = options.compare ?? true;
  const report = deltaReportOf(analyzeDelta(root, files, { base: options.base, compare }), min);
  const comparison = compare ? `Comparison with ${options.base}: ${reportFolder}/compare.html\n` : '';
  return { text: `${report.text}${comparison}`, passed: report.passed };
}
