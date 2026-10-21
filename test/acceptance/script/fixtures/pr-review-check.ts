import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { prReviewCheckScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import type { GitRepository } from './git-repository.ts';

export const manualNote = '- The steps "Metrics" and "Decision" of the review route are manual: do them before Ready, as AGENTS.md says.';

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
