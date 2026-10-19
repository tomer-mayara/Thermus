import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseSnapshot, edited, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

const provenance = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' } as const;

test('Given offline snapshots and a rename tied to both source identities, when architecture reads --changes without tools, then it compares one row at the new path', async (t) => {
  const base = { ...baseSnapshot, provenance };
  const head = edited({ ...base, provenance: { ...provenance, sourceFingerprint: 'c'.repeat(64) } }, { files: { 'src/application.ts': { path: 'src/renamed.ts' } } });
  const changes = join(dataDirectory(t), 'changes.json');
  writeFileSync(changes, JSON.stringify({ version: 1,
    base: { commit: base.commit, sourceFingerprint: base.provenance.sourceFingerprint },
    head: { commit: head.commit, sourceFingerprint: 'c'.repeat(64) },
    files: [{ status: 'R', oldPath: 'src/application.ts', path: 'src/renamed.ts' }],
  }));
  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, base, head), '--changes', changes, '--no-coverage'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes('src/renamed.ts'));
  assert.ok(!result.stdout.includes('| src/application.ts |'));
  assert.match(result.stdout, /52\.0/);
});
