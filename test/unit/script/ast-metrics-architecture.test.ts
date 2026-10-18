import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// The command line and the snapshot files of the architecture command. ast-metrics-architecture-report.test.ts
// specifies the rules of the report. An empty PATH has no git and no ast-metrics. Thus these cases also show that the
// command checks its arguments first, and that it reads snapshot files without either tool.
const noTools = { env: { PATH: '' } };

test('Given --help, when the architecture command runs, then it explains the two sources of the snapshots, the changed files, the matching, the change of the map, the complexity table, the options, and the exit status', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--help'], ...noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/ast-metrics-architecture\.ts \[--base REF\] \[--head FILE --base-snapshot FILE\] \[--touched FILES\] \[--timeout-ms MS\] \[--out FILE\] \[--help\]\n/);
  const texts = ['Mermaid', 'merge base', 'temporary worktree', 'working tree', 'untracked', 'Jaccard', '0.5', 'new or gone', 'did not change', 'default: origin/main'];
  const table = ['complexity table', 'ten riskiest', 'not measured', 'no production file changed'];
  for (const text of [...texts, ...table, 'default: 60000', 'not a gate', 'Exit status 1', 'Exit status 130 or 143']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

const together = 'Give --head and --base-snapshot together, each with a snapshot file.';

for (const [args, diagnostic] of [
  [['--head', 'snapshot.json'], together],
  [['--base-snapshot', 'snapshot-base.json'], together],
  [['--head=', '--base-snapshot', 'snapshot-base.json'], together],
  [['--base='], 'The --base value must name a git ref.'],
  [['--base=--output=diff.txt'], 'The --base value must name a git ref.'],
  [['--out='], 'The --out value must name a file.'],
  [['--timeout-ms', '99'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--timeout-ms', '1e3'], 'The --timeout-ms value must be an integer from 100 to 300000.'],
  [['--verbose'], 'Invalid arguments. Use --help for the supported options.'],
  [['main'], 'Invalid arguments. Use --help for the supported options.'],
  [['--head'], 'Invalid arguments. Use --help for the supported options.'],
] as const) {
  test(`Given the arguments ${args.join(' ')}, when the architecture command runs, then it fails with one diagnostic line`, async (t) => {
    const result = await runScript(t, astMetricsArchitectureScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-architecture: ${diagnostic}\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

// Writes each text to a file of its own and gives the arguments that name the files.
function fileArguments(t: TestContext, head: string, base: string): string[] {
  const folder = dataDirectory(t);
  writeFileSync(join(folder, 'head.json'), head);
  writeFileSync(join(folder, 'base.json'), base);
  return ['--head', join(folder, 'head.json'), '--base-snapshot', join(folder, 'base.json')];
}

test('Given a --head file that does not exist, when the architecture command runs, then it fails with one diagnostic line that names the file', async (t) => {
  const missing = join(dataDirectory(t), 'missing.json');

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--head', missing, '--base-snapshot', missing], ...noTools });

  assert.equal(result.stderr, `ast-metrics-architecture: Cannot read the snapshot file ${missing}.\n`);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

// The parts of a snapshot that the command reads, as script/ast-metrics-snapshot.ts writes them.
const valid = {
  version: 1,
  commit: 'c0ffee00c0ffee00',
  global: { modularity: 0.5, crossShare: 0.25, cycles: [] },
  communities: [{ id: '0', label: 'a', members: ['src/a/0.ts'], files: 1, paths: 10, edges: [{ to: '0', references: 1, inCycle: false }] }],
  files: [{ path: 'src/a/0.ts', maintainability: 70, paths: 10, risk: 0.5 }],
};
const [validCommunity] = valid.communities;

for (const [name, text] of [
  ['text that is not JSON', 'Snapshot'],
  ['a JSON array', '[]'],
  ['a snapshot of version 2', JSON.stringify({ ...valid, version: 2 })],
  ['a snapshot without a commit', JSON.stringify({ ...valid, commit: undefined })],
  ['a modularity that is text', JSON.stringify({ ...valid, global: { ...valid.global, modularity: '0.5' } })],
  ['a snapshot without communities', JSON.stringify({ ...valid, communities: undefined })],
  ['a community without a label', JSON.stringify({ ...valid, communities: [{ ...validCommunity, label: undefined }] })],
  ['an edge without a target', JSON.stringify({ ...valid, communities: [{ ...validCommunity, edges: [{ references: 1, inCycle: false }] }] })],
  ['a snapshot without files', JSON.stringify({ ...valid, files: undefined })],
  ['a file without a path', JSON.stringify({ ...valid, files: [{ maintainability: 70, paths: 10 }] })],
] as const) {
  test(`Given a --base-snapshot file with ${name}, when the architecture command runs, then it fails with one diagnostic line that names the file`, async (t) => {
    const args = fileArguments(t, JSON.stringify(valid), text);

    const result = await runScript(t, astMetricsArchitectureScript, { args, ...noTools });

    assert.equal(result.stderr, `ast-metrics-architecture: The file ${args[3]} is not a valid snapshot of version 1.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}
