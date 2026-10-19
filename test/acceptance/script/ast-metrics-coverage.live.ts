import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astMetricsCoverageScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// This check runs emitted Node and source portal unit tests under V8 coverage on this repository: about two
// minutes on a developer Mac. The command builds first. On a shared host run no other suite at the same time. The check
// uses its own temporary report and preserves the default report.
const root = fileURLToPath(repositoryRoot);

type CoverageReport = {
  readonly suite: string;
  readonly commit: string;
  readonly measurementVersion: string;
  readonly provenance: { readonly status: string; readonly capturedCommit: string; readonly captureManifestFingerprint: string; readonly buildFingerprint: string; readonly inputsFingerprint: string };
  readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly called: number }[] }[];
};

test('Given this repository, when the command builds and runs the unit suite, then coverage.json names the unit suite, holds createApplication, shows calls of other application functions, and shows initializePortal called by portal unit tests, within 5 minutes', { timeout: 300_000 }, async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'thermus-coverage-live-'));
  const reportFile = join(folder, 'coverage.json');
  t.after(() => rmSync(folder, { recursive: true, force: true }));

  const result = await runScript(t, astMetricsCoverageScript, { args: ['--out', reportFile], cwd: root });

  // The output of the suite is long; its end holds the summary and the diagnostic.
  assert.equal(result.code, 0, result.stderr.slice(-4000));
  assert.ok(result.stdout.startsWith(`Wrote ${reportFile}. Files: `), result.stdout);
  const report = JSON.parse(readFileSync(reportFile, 'utf8')) as CoverageReport;
  assert.equal(report.suite, 'unit');
  assert.equal(report.measurementVersion, 'own-characters-1');
  assert.equal(report.provenance.status, 'verified');
  assert.equal(report.commit, report.provenance.capturedCommit);
  for (const hash of [report.provenance.captureManifestFingerprint, report.provenance.buildFingerprint, report.provenance.inputsFingerprint]) assert.match(hash, /^[a-f0-9]{64}$/);
  const portal = report.files.find((file) => file.path === 'src/user-portal/portal.ts');
  assert.ok(portal?.functions.some((entry) => entry.name === 'initializePortal' && entry.called >= 1), JSON.stringify(portal));
  const application = report.files.find((file) => file.path === 'src/application.ts');
  assert.ok(application !== undefined, 'The report has no entry for src/application.ts.');
  assert.ok(application.functions.some((entry) => entry.name === 'createApplication'), JSON.stringify(application));
  // Only the integration and acceptance tests call createApplication; the unit tests call other functions of the file.
  assert.ok(application.functions.some((entry) => entry.name !== '(anonymous)' && entry.called >= 1), JSON.stringify(application));
});
