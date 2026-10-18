import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsMcpFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { astMetricsMcpScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// The command checks its command line before it looks for the repository root, so these cases need no git
// repository. The double is first on PATH: its empty request log shows that no server started.

test('Given --help, when the command runs, then it prints the usage of each subcommand and starts no server', async (t) => {
  const fake = astMetricsMcpFakeOnPath(t);
  const result = await runScript(t, astMetricsMcpScript, ['--help'], { env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  for (const usage of ['file <path> [--json]', 'complex [--limit N] [--max-cyclomatic N]', 'risky [--limit N]', 'overview', 'tools', 'call <tool> [<json arguments>]', '--timeout-ms MS']) {
    assert.ok(result.stdout.includes(usage), `The help does not show ${usage}.`);
  }
  assert.equal(result.stderr, '');
  assert.deepEqual(fake.requests(), []);
});

for (const [name, args, diagnostic] of [
  ['no subcommand', [], /Give a subcommand/],
  ['an unknown subcommand', ['explain'], /Unknown subcommand: explain\./],
  ['file without a path', ['file'], /Usage: node script\/ast-metrics-mcp\.mjs file <path> \[--json\]/],
  ['file with two paths', ['file', 'a.ts', 'b.ts'], /file <path>/],
  ['call without a tool', ['call'], /call <tool> \[<json arguments>\]/],
  ['call with text that is not JSON', ['call', 'find_risky_code', '{limit'], /JSON object/],
  ['call with a JSON array', ['call', 'find_risky_code', '[1]'], /JSON object/],
  ['a timeout below the range', ['overview', '--timeout-ms', '99'], /--timeout-ms/],
  ['a timeout above the range', ['overview', '--timeout-ms', '300001'], /--timeout-ms/],
  ['a timeout that is not an integer', ['overview', '--timeout-ms', '1e3'], /--timeout-ms/],
  ['a limit of zero', ['complex', '--limit', '0'], /--limit value must be an integer of 1 or more/],
  ['a complexity threshold that is not a number', ['complex', '--max-cyclomatic', 'high'], /--max-cyclomatic value/],
  ['an option of another subcommand', ['risky', '--max-cyclomatic', '5'], /--max-cyclomatic option is not valid with risky/],
  ['--json with another subcommand', ['overview', '--json'], /--json option is not valid with overview/],
  ['an unknown option', ['overview', '--verbose'], /Invalid arguments/],
] as const) {
  test(`Given ${name}, when the command runs, then it fails with one diagnostic line and starts no server`, async (t) => {
    const fake = astMetricsMcpFakeOnPath(t);
    const result = await runScript(t, astMetricsMcpScript, args, { env: fake.env });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^ast-metrics-mcp: [^\n]+\n$/);
    assert.match(result.stderr, diagnostic);
    assert.deepEqual(fake.requests(), []);
  });
}
