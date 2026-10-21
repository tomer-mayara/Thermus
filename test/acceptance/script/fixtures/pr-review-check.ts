import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { prReviewCheckScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import type { GitRepository } from './git-repository.ts';

export const manualNote = '- Local eligibility is preliminary. The trusted merge gate must verify current checks, holds, and independent human approval.';
export const snapshotOptions = ['--base-snapshot', 'ast-report/snapshot-base.json', '--head-snapshot', 'ast-report/snapshot.json'];
export const crapOptions = ['--crap', 'ast-report/crap.json'];
export const metricsOptions = ['--process', 'ast-report/process.json', '--review', 'ast-report/review.json'];
export const decisionNote = manualNote;

type RawValues = Readonly<Record<string, number | undefined>>;
type Commits = { readonly base: string; readonly head: string };

// A row of the JSON that script/code-quality/ast-metrics-crap.ts writes with --json.
export interface CrapRowFixture {
  readonly file: string;
  readonly function: string;
  readonly change: string;
  readonly paths: number;
  readonly share?: number;
  readonly crap?: number;
}

// A regression of the JSON that the review stage of the metrics process writes to ast-report/review.json.
export interface FindingFixture {
  readonly severity: string;
  readonly file: string;
  readonly message: string;
}

export function checkOn(t: TestContext, repository: GitRepository, ...args: string[]) {
  const impact = {
    version: 1, base: repository.git('rev-parse', 'main').trim(), head: repository.git('rev-parse', 'HEAD').trim(),
    classification: { container: false, external: false, contract: false, deployment: false, crossCutting: false, component: false, internalInterface: false, sensitiveBehavior: false, dependencyRisk: false, policy: false, uncertain: false },
    architecture: { modelUpdated: false, summary: 'No further semantic change in this guard scenario.', views: ['Context', 'Runtime'], evidence: ['The committed fixture.'] },
  };
  repository.write({ '.git/pr-review-impact.json': JSON.stringify(impact) });
  return runScript(t, prReviewCheckScript, { args: ['--base', 'main', '--impact', '.git/pr-review-impact.json', ...args], cwd: repository.root });
}

// A list of the report ends at the next empty line.
export function linesUnder(report: string, heading: string): string[] {
  const lines = report.split('\n');
  const start = lines.indexOf(`${heading}:`);
  assert.notEqual(start, -1, `The report has no heading "${heading}:".\n${report}`);
  return lines.slice(start + 1, lines.indexOf('', start));
}

export function tierOf(report: string): string | undefined {
  return /^Tier: `(T[012]) [^`]+`$/m.exec(report)?.[1];
}

export function eligibilityOf(report: string): string | undefined {
  return /^Local eligibility: `(eligible|blocked)`$/m.exec(report)?.[1];
}

export function snapshotText(commit: string, files: RawValues): string {
  return JSON.stringify({ version: 1, commit, tool: '0.43.1', files: Object.entries(files).map(([path, maintainabilityRaw]) => ({ path, maintainabilityRaw })) });
}

export function commitsOf(repository: GitRepository): { readonly base: string; readonly head: string } {
  return { base: repository.git('rev-parse', 'main').trim(), head: repository.git('rev-parse', 'HEAD').trim() };
}

export function writeSnapshots(repository: GitRepository, base: RawValues, head: RawValues): void {
  const commits = commitsOf(repository);
  repository.write({ 'ast-report/snapshot-base.json': snapshotText(commits.base, base), 'ast-report/snapshot.json': snapshotText(commits.head, head) });
}

export function crapText(commits: { readonly base: string; readonly head: string }, rows: readonly CrapRowFixture[]): string {
  return JSON.stringify({ version: 1, base: commits.base, head: commits.head, rows });
}

// The CRAP command writes its rows of HEAD to ast-report/, which git ignores.
export function writeCrap(repository: GitRepository, rows: readonly CrapRowFixture[]): void {
  repository.write({ 'ast-report/crap.json': crapText(commitsOf(repository), rows) });
}

export function processText(commits: Commits, statuses: readonly string[]): string {
  const outcomes = ['Delta', 'Review', 'CRAP', 'Architecture'].slice(0, statuses.length).map((name, index) => ({ name, status: statuses[index], text: `${name} evidence.` }));
  return JSON.stringify({ version: 1, base: commits.base, head: commits.head, outcomes });
}

export function reviewText(commits: Commits, findings: readonly FindingFixture[]): string {
  const regressions = findings.map((finding) => ({ kind: 'regression', rule: 'new-violation:maintainability', ...finding }));
  return JSON.stringify({ methodologyVersion: '1.1', baseRef: 'main', baseSha: commits.base, headSha: commits.head, regressions, improvements: [] });
}

// Without findings, no review file is written, as after a Review stage that did not complete.
export function writeMetrics(repository: GitRepository, statuses: readonly string[], findings?: readonly FindingFixture[]): void {
  const commits = commitsOf(repository);
  repository.write({
    'ast-report/process.json': processText(commits, statuses),
    ...(findings === undefined ? {} : { 'ast-report/review.json': reviewText(commits, findings) }),
  });
}
