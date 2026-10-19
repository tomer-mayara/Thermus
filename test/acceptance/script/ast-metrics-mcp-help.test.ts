import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsMcpScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

test('Given no git or ast-metrics on PATH, when MCP help runs, then it explains the score range and distinguishes LOC from source positions', async (t) => {
  const result = await runScript(t, astMetricsMcpScript, { args: ['--help'], cwd: dataDirectory(t), env: { PATH: '' } });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /--limit N +complex, risky: the maximum number of results \(default: delegated to ast-metrics\)/);
  assert.match(result.stdout, /--max-cyclomatic N +complex: show the items above this complexity \(default: delegated to ast-metrics\)/);
  assert.ok(result.stdout.endsWith([
    'The score is the maintainability index (0 to 128; more is better). The paths are the',
    'decision paths (cyclomatic complexity). The lines column is a count of lines of',
    'code (LOC), not a source position.',
    '',
  ].join('\n')), result.stdout);
});
