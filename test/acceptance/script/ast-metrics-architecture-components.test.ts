import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseSnapshot, file, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

const files = ['src/application.ts', 'src/auth/session.ts', 'src/auth/policy.ts', 'src/mcp/tool.ts', 'src/alone/types.ts'];
const pairs = [
  { from: files[0], to: files[1], kinds: ['static'] },
  { from: files[0], to: files[2], kinds: ['type'] },
  { from: files[1], to: files[2], kinds: ['static'] },
  { from: files[1], to: files[3], kinds: ['dynamic'] },
  { from: files[3], to: files[1], kinds: ['re-export'] },
];
const snapshot = {
  ...baseSnapshot, communities: [],
  files: files.map((path) => ({ ...file(path, null, { paths: 2, maintainability: 80 }), loc: 10 })),
  dependencies: { version: 1, pairs, issues: [] },
};
const legend = 'Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.';
const expected = [
  '## Components of src/', '', 'The component map did not change.', '', '```mermaid', 'flowchart LR',
  '  c_alone["alone<br/>1 file · MI 80.0 · paths 2"]',
  '  c_auth["auth<br/>2 files · MI 80.0 · paths 4"]',
  '  c_mcp["mcp<br/>1 file · MI 80.0 · paths 2"]',
  '  c_src["src<br/>1 file · MI 80.0 · paths 2"]',
  '  c_auth -. "1 · cycle" .-> c_mcp', '  c_mcp -. "1 · cycle" .-> c_auth', '  c_src -- "1" --> c_auth',
  '  linkStyle 0 stroke:#d03b3b,stroke-width:2px', '  linkStyle 1 stroke:#d03b3b,stroke-width:2px',
  '  classDef touched stroke-width:3px', '  classDef gone stroke-dasharray:4 4,color:#999999', '```', '', legend, '',
].join('\n');

test('Given populated folders, root files, repeated imports and an internal pair, when offline architecture runs, then its stable component graph deduplicates edges and shows only cross-folder cycles', { timeout: 20_000 }, async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, snapshot, snapshot), env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.split('## Components of src/')[1]?.split('## Complexity')[0]?.trimEnd(), expected.split('## Components of src/')[1]?.trimEnd());
});

const incompleteNotice = 'Component dependency evidence is incomplete: known head dependencies and proven cycles are shown; edge and cycle changes are withheld. Additional dependencies or cycles may exist.';

test('Given known cross-folder dependencies and an unresolved stylesheet import, when offline architecture runs, then it shows proven head edges and cycles without change claims', { timeout: 20_000 }, async (t) => {
  const partial = { ...snapshot, dependencies: { ...snapshot.dependencies, issues: [{ path: files[0], specifier: './style.css', reason: 'unresolved-local' }] } };
  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, snapshot, partial), env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.split('## Components of src/')[1]?.split('## Complexity')[0]?.trimEnd(), expected.replace('The component map did not change.', incompleteNotice).split('## Components of src/')[1]?.trimEnd());
});
