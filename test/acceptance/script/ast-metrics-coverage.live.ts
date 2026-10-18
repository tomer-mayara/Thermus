import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// This check runs the real unit suite of dist/ under V8 coverage on this repository: about two minutes on a
// developer Mac. Run npm run build first, and on a shared host run no other suite at the same time. The check
// removes ast-report/coverage.json afterwards.
const root = fileURLToPath(repositoryRoot);
const reportFile = join(root, 'ast-report', 'coverage.json');

type CoverageReport = {
  readonly suite: string;
  readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly called: number }[] }[];
};

test('Given a build of this repository, when the command runs the unit suite, then coverage.json names the unit suite, holds createApplication of src/application.ts, and shows calls of other functions of that file, within 5 minutes', { timeout: 300_000 }, async (t) => {
  t.after(() => rmSync(reportFile, { force: true }));

  const result = await runScript(t, astMetricsCoverageScript, { cwd: root });

  // The output of the suite is long; its end holds the summary and the diagnostic.
  assert.equal(result.code, 0, result.stderr.slice(-4000));
  assert.match(result.stdout, /^Wrote ast-report\/coverage\.json\. Files: \d+\. Processes: \d+\.\n$/);
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as CoverageReport;
  assert.equal(report.suite, 'unit');
  const application = report.files.find((file) => file.path === 'src/application.ts');
  assert.ok(application !== undefined, 'The report has no entry for src/application.ts.');
  assert.ok(application.functions.some((entry) => entry.name === 'createApplication'), JSON.stringify(application));
  // Only the integration and acceptance tests call createApplication; the unit tests call other functions of the file.
  assert.ok(application.functions.some((entry) => entry.name !== '(anonymous)' && entry.called >= 1), JSON.stringify(application));
});
