import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { prReviewCheckScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import type { GitRepository } from './git-repository.ts';

export const manualNote = '- The steps "Metrics" and "Decision" of the review route are manual: do them before Ready, as AGENTS.md says.';
export const snapshotOptions = ['--base-snapshot', 'ast-report/snapshot-base.json', '--head-snapshot', 'ast-report/snapshot.json'];

type RawValues = Readonly<Record<string, number | undefined>>;

export function checkOn(t: TestContext, repository: GitRepository, ...args: string[]) {
  return runScript(t, prReviewCheckScript, { args: ['--base', 'main', ...args], cwd: repository.root });
}

// A list of the report ends at the next empty line.
export function linesUnder(report: string, heading: string): string[] {
  const lines = report.split('\n');
  const start = lines.indexOf(`${heading}:`);
  assert.notEqual(start, -1, `The report has no heading "${heading}:".\n${report}`);
  return lines.slice(start + 1, lines.indexOf('', start));
}

export function routeOf(report: string): string | undefined {
  return /^Route: `(\w+)`$/m.exec(report)?.[1];
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
