import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { astMetricsMcpScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// These checks run the real ast-metrics on this repository. They need the executable on PATH; the guide is
// docs/implementation/ast-metrics-review.md. Without it, Node reports each check as skipped.
const installed = (process.env.PATH ?? '').split(delimiter).some((folder) => folder !== '' && existsSync(join(folder, 'ast-metrics')));
const live = { timeout: 30_000, skip: installed ? false : 'ast-metrics is not on PATH' };
const root = fileURLToPath(repositoryRoot);

test('Given the real ast-metrics and a production file, when file runs in the repository root, then it prints one line for each function within 30 seconds', live, async (t) => {
  const result = await runScript(t, astMetricsMcpScript, { args: ['file', 'src/application.ts'], cwd: root });
  assert.equal(result.code, 0, result.stderr);
  const [header, heading, ...functions] = result.stdout.trimEnd().split('\n');
  const summary = /^src\/application\.ts: (?:score \d+\.\d, )?\d+ decision paths?, (\d+) functions?$/.exec(header);
  assert.ok(summary, header);
  assert.equal(heading, '  score  paths  lines  name');
  assert.ok(functions.length > 0, result.stdout);
  for (const line of functions) assert.match(line, /^ +(\d+\.\d|-) +\d+ +\d+ {2}\S/);
  assert.equal(functions.length, Number(summary[1]), result.stdout);
});

test('Given the real ast-metrics and a file that does not exist, when file runs in the repository root, then it fails with the text of ast-metrics within 30 seconds', live, async (t) => {
  const result = await runScript(t, astMetricsMcpScript, { args: ['file', 'src/does-not-exist.ts'], cwd: root });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-mcp: get_file_metrics failed: File not found in analysis: src/does-not-exist.ts\n');
});
