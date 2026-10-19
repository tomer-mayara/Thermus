import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { MapSources } from '../../../script/code-quality/architecture/types.ts';
import { astMetricsArchitectureScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { changedImportSourcesOf, movedAndRegroupedSourcesOf, provenMoves, regroupedSourcesOf, renamedSourcesOf } from '../../support/fixtures/ast-metrics-community-evidence.ts';

const cases: readonly [string, string, () => MapSources][] = [
  ['unchanged imports regrouped between matched communities', 'regrouped', regroupedSourcesOf],
  ['an added import', 'added', changedImportSourcesOf],
  ['twelve import pairs', 'truncated', () => changedImportSourcesOf(12)],
  ['proven endpoint moves and community regrouping', 'moved-regrouped', movedAndRegroupedSourcesOf],
  ['proven path moves', 'renamed', () => renamedSourcesOf(provenMoves)],
  ['equal basenames without move evidence', 'unproven', () => renamedSourcesOf([])],
  ['legacy snapshots', 'legacy', () => { const sources = changedImportSourcesOf(); return { ...sources, base: { ...sources.base, dependencies: undefined }, head: { ...sources.head, dependencies: undefined } }; }],
];

for (const [given, golden, sourcesOf] of cases) {
  test(`Given ${given}, when the offline architecture command runs, then it reports supported community evidence`, async (t) => {
    const result = await runScript(t, astMetricsArchitectureScript, { args: evidenceArgumentsOf(t, sourcesOf()), env: { PATH: '' } });
    assert.equal(result.code, 0, result.stderr);
    const section = result.stdout.split('### Community edge evidence\n')[1]?.split('\n## Components of src/')[0].split('\n## Complexity of the changed files')[0];
    const expected = readFileSync(new URL(`test/acceptance/script/fixtures/community-evidence/${golden}.md`, repositoryRoot), 'utf8');
    assert.equal(section === undefined ? undefined : `### Community edge evidence\n${section}`.trimEnd(), expected.trimEnd());
    if (given.startsWith('unchanged') || given.startsWith('proven')) assert.doesNotMatch(section ?? '', /— import (?:added|removed)\./u);
    if (given.startsWith('equal')) assert.doesNotMatch(section ?? '', /### Proven path moves/u);
  });
}

function evidenceArgumentsOf(t: TestContext, sources: MapSources): string[] {
  const folder = dataDirectory(t);
  const before = join(folder, 'base.json');
  const after = join(folder, 'head.json');
  writeFileSync(before, JSON.stringify({ version: 1, ...sources.base }));
  writeFileSync(after, JSON.stringify({ version: 1, ...sources.head }));
  const args = ['--base-snapshot', before, '--head', after];
  if (sources.changes === undefined) return args;
  assert.ok(sources.base.provenance);
  assert.ok(sources.head.provenance);
  const changes = join(folder, 'changes.json');
  writeFileSync(changes, JSON.stringify({ version: 1, base: { commit: sources.base.commit, sourceFingerprint: sources.base.provenance.sourceFingerprint }, head: { commit: sources.head.commit, sourceFingerprint: sources.head.provenance.sourceFingerprint }, files: sources.changes }));
  return [...args, '--changes', changes];
}
