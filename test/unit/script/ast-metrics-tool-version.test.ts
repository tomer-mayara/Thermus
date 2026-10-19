import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';

const { checkServerToolVersion, cliToolVersion } = await import(new URL('shared/tool-version.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/shared/tool-version.ts');

test('Given the pinned server version, when checked, then the session can continue', () => {
  assert.doesNotThrow(() => checkServerToolVersion('0.43.1', {}));
});

test('Given an unsupported version, when checked, then only an explicit override permits it', () => {
  assert.throws(() => checkServerToolVersion('9.8.7', {}), { message: 'ast-metrics 9.8.7 is not the pinned 0.43.1; run with --allow-tool-version to continue.' });
  assert.doesNotThrow(() => checkServerToolVersion('9.8.7', { allowToolVersion: true }));
  assert.throws(() => checkServerToolVersion(undefined, { allowToolVersion: true }), /did not report its tool version/);
});

test('Given a checked composite, when an MCP session reports another version, then it fails even with the override', () => {
  const checked = { actual: '9.8.7', allowToolVersion: true };
  checkServerToolVersion('9.8.7', { checked });
  assert.throws(() => checkServerToolVersion('0.43.1', { checked }), /differs from the checked CLI version 9.8.7/);
  assert.throws(() => checkServerToolVersion(undefined, { checked }), /version unknown differs/);
});

test('Given the CLI version display, when checked, then the version subcommand supplies the actual version', (t) => {
  const fake = astMetricsCliFakeOnPath(t);
  const original = process.env;
  process.env = { ...original, ...fake.env };
  t.after(() => { process.env = original; });
  assert.deepEqual(cliToolVersion(process.cwd()), { actual: '0.43.1', allowToolVersion: false });
  assert.deepEqual(fake.calls().map(({ argv }) => argv), [['version']]);
});

test('Given different or missing snapshot tool versions, when compared offline, then the notice identifies both versions', async () => {
  const { toolNoticeOf } = await import(new URL('architecture/tool-notice.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/architecture/tool-notice.ts');
  assert.deepEqual(toolNoticeOf({ tool: '0.43.1' }, { tool: '9.8.7' }), ['Tool versions: base ast-metrics 0.43.1; head ast-metrics 9.8.7.', '']);
  assert.deepEqual(toolNoticeOf({}, { tool: '9.8.7' }), ['Tool versions: base ast-metrics unknown; head ast-metrics 9.8.7.', '']);
  assert.deepEqual(toolNoticeOf({ tool: '0.43.1' }, { tool: '0.43.1' }), []);
});

test('Given mixed trend tool versions, when the trend is rendered, then the notice names the version of each row', async () => {
  const { trendToolNoticeOf } = await import(new URL('architecture/tool-notice.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/architecture/tool-notice.ts');
  assert.deepEqual(trendToolNoticeOf([{ commit: 'abcdefgh1234', tool: '0.43.1' }, { tool: '9.8.7' }]), ['', 'Trend tool versions: abcdefgh: ast-metrics 0.43.1; this pull request: ast-metrics 9.8.7.']);
  assert.deepEqual(trendToolNoticeOf([{ commit: 'abcdefgh1234' }, { tool: '9.8.7' }]), ['', 'Trend tool versions: abcdefgh: ast-metrics unknown; this pull request: ast-metrics 9.8.7.']);
  assert.deepEqual(trendToolNoticeOf([{ tool: '0.43.1' }, { tool: '0.43.1' }]), []);
});
