import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CommandError } from '../code-quality/shared/command-error.ts';
import type { Revision } from './replay-revisions.ts';
import type { Stage } from './replay-workspace.ts';
import type { CheckResult, Reason } from './types.ts';

const evaluationOnly = 'Evaluation only: this result is never evidence for a candidate. The trusted merge-base policy governs a real candidate.';
const factLength = 60;

// One target in the report. A failed row has a failure and no result; it keeps the commits that the replay found.
export interface Row extends Partial<Revision> {
  readonly label: string;
  readonly file: string;
  readonly notes: readonly string[];
  readonly baseCommit?: string;
  readonly headCommit?: string;
  readonly result?: CheckResult;
  readonly failure?: { readonly stage: Stage; readonly message: string };
}

export interface Report {
  readonly evaluatedRules: string;
  readonly uncommittedChanges: boolean;
  readonly rows: readonly Row[];
}

export interface ReportTexts {
  readonly markdown: string;
  readonly json: string;
}

export function textsOf(report: Report): ReportTexts {
  return { markdown: markdownOf(report), json: `${JSON.stringify(report, null, 2)}\n` };
}

// The folder is made before the run, so that a wrong --out stops the run before its work.
export function reportFolderOf(root: string, out: string | undefined): string {
  const folder = out === undefined ? join(root, 'ast-report', 'replay') : resolve(out);
  try {
    mkdirSync(folder, { recursive: true });
  } catch (error) {
    throw new CommandError(`Cannot make the report folder ${folder}: ${(error as Error).message}`);
  }
  return folder;
}

// A failed row removes the check file of an earlier run, so that the folder holds no result that this run did not make.
export function writeReport(folder: string, report: Report, texts: ReportTexts): void {
  try {
    writeFileSync(join(folder, 'replay.md'), texts.markdown);
    writeFileSync(join(folder, 'replay.json'), texts.json);
    for (const row of report.rows) {
      const path = join(folder, row.file);
      if (row.result === undefined) rmSync(path, { force: true });
      else writeFileSync(path, `${JSON.stringify(row.result, null, 2)}\n`);
    }
  } catch (error) {
    throw new CommandError(`Cannot write the report to ${folder}: ${(error as Error).message}`);
  }
}

function markdownOf(report: Report): string {
  const failures = report.rows.flatMap((row) => (row.failure === undefined ? [] : [`${row.label}: ${row.failure.stage} failed. ${row.failure.message}`]));
  const notes = report.rows.flatMap((row) => row.notes.map((note) => `${row.label}: ${note}`));
  return [
    '# Rule replay', '',
    evaluationOnly, '',
    `Rules and checker: the working tree at ${report.evaluatedRules}${report.uncommittedChanges ? ', with uncommitted changes' : ''}.`, '',
    '| PR | tier | eligibility | architecture facts | other reasons | blockers |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.rows.map(tableRow), '',
    totalsOf(report.rows), '',
    ...section('Failures', failures),
    ...section('Notes', notes),
  ].join('\n');
}

// A fact text is cut to its first 60 characters, so that the table stays readable; replay.json keeps the full results.
function tableRow(row: Row): string {
  const { result } = row;
  if (result === undefined) return cells([row.label, `${row.failure?.stage ?? 'replay'} failed`, '—', '—', '—', '—']);
  const groups = [...Map.groupBy(result.reasons, (reason) => reason.key)];
  const facts = groups.filter(([key]) => key.startsWith('architecture.'));
  const others = groups.filter(([key]) => !key.startsWith('architecture.'));
  return cells([
    row.label, result.tierName, result.eligibility,
    facts.map(([key, reasons]) => `${key}×${reasons.length}: ${reasons.map((reason) => shortened(reason.fact)).join('; ')}`).join('<br>') || '—',
    others.map(([key, reasons]) => `${key}×${reasons.length}`).join(' ') || '—',
    [...new Set(result.blockers.map((blocker: Reason) => blocker.key))].join(' ') || '—',
  ]);
}

function shortened(text: string): string {
  return text.length > factLength ? `${text.slice(0, factLength)}…` : text;
}

function cells(values: readonly string[]): string {
  return `| ${values.map((value) => value.replace(/\|/gu, '\\|').replace(/\s*\n\s*/gu, ' ')).join(' | ')} |`;
}

function totalsOf(rows: readonly Row[]): string {
  const count = (tier: string) => rows.filter((row) => row.result?.tier === tier).length;
  return `Totals: T0 ${count('T0')}, T1 ${count('T1')}, T2 ${count('T2')}, failed ${rows.filter((row) => row.result === undefined).length}.`;
}

function section(heading: string, items: readonly string[]): string[] {
  return items.length === 0 ? [] : [`## ${heading}`, '', ...items.map((item) => `- ${item}`), ''];
}
