import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsBaselineScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

const { ignoredEntryCount } = await import(new URL('baseline/ignored-count.ts', pathToFileURL(astMetricsBaselineScript)).href) as typeof import('../../../script/code-quality/baseline/ignored-count.ts');

test('Given --help outside a repository without tools, when baseline runs, then it explains the command and baseline policy', async (t) => {
  const result = await runScript(t, astMetricsBaselineScript, { cwd: tmpdir(), args: ['--help'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  for (const text of ['--allow-tool-version', '.ast-metrics-baseline.yaml', 'before', 'after', 'permission']) assert.ok(result.stdout.includes(text), text);
});

for (const args of [['--unknown'], ['--base', 'main'], ['extra'], ['--allow-tool-version=yes']]) {
  test(`Given invalid arguments ${args.join(' ')}, when baseline runs, then it rejects them before tool or Git access`, async (t) => {
    const result = await runScript(t, astMetricsBaselineScript, { args, env: { PATH: '' } });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'ast-metrics-baseline: Invalid arguments. Use --help for the supported options.\n');
  });
}

test('Given the generated tool shape, when counted, then each ignored entry counts once regardless of its occurrence count', () => {
  const input = `# Generated baseline\nignored:
    - rule: max_loc
      file: src/a.ts
      message: 'LOC too high: got 151 (max: 150)'
      count: 9
    - rule: max_loc_by_method
      file: src/b.ts
      message: 'The string ''- rule: fake'' is not an entry'
      count: 1
`;
  assert.equal(ignoredEntryCount(input), 2);
  assert.equal(ignoredEntryCount('# - rule: comment\nignored: []\ncomment: "- rule: lookalike"\n'), 0);
});

test('Given YAML quoting and a multiline message, when counted, then scalar text cannot create extra entries', () => {
  assert.equal(ignoredEntryCount(`"ignored":
  - rule: max_loc
    file: src/example.ts
    message: |-
      - rule: lookalike
      # ignored: []
    count: 1
`), 1);
});

for (const input of ['', 'ignored: wrong\n', 'ignored: [\n', 'ignored: []\nignored: []\n', 'ignored:\n  - rule: example\n', 'message: "ignored: []"\n', 'ignored: ["- rule: fake"]\n', 'ignored: [{rule: true, file: a, message: text, count: 1}]\n', 'ignored: [{rule: max_loc, file: a, message: text, count: 0}]\n']) {
  test(`Given invalid baseline data ${JSON.stringify(input)}, when counted, then it refuses an invented count`, () => {
    assert.throws(() => ignoredEntryCount(input), /not a valid ast-metrics baseline/);
  });
}
