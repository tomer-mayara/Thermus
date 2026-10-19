import assert from 'node:assert/strict';
import { test } from 'node:test';
import { communityEvidenceLinesOf } from '../../../script/code-quality/architecture/dependency-explanations.ts';
import { architectureMapOf } from '../../../script/code-quality/architecture/map.ts';
import type { MapSources } from '../../../script/code-quality/architecture/types.ts';
import { changedImportSourcesOf, dependencyPairOf, evidenceSnapshotOf, movedAndRegroupedSourcesOf, provenMoves, regroupedSourcesOf, renamedSourcesOf } from '../../support/fixtures/ast-metrics-community-evidence.ts';

function linesOf(sources: MapSources): string[] {
  return communityEvidenceLinesOf(sources, architectureMapOf(sources, undefined));
}

test('Given the same file import in different matched communities, when evidence is rendered, then it names regrouping without an import change', () => {
  const lines = linesOf(regroupedSourcesOf());
  assert.ok(lines.includes('  - `src/a/client.ts` → `src/b/moved.ts` — unchanged import; community regrouping.'));
  assert.ok(lines.includes('- `src/b/moved.ts`: beta → gamma.'));
  assert.doesNotMatch(lines.join('\n'), /— import (added|removed)/u);
});

test('Given proven moves of both import endpoints, when evidence is rendered, then it reports paths without an import change or community regrouping', () => {
  const lines = linesOf(renamedSourcesOf(provenMoves));
  assert.ok(lines.includes('- `src/old/client.ts` → `src/new/client.ts`.'));
  assert.ok(lines.includes('- `src/old/target.ts` → `src/new/target.ts`.'));
  assert.doesNotMatch(lines.join('\n'), /community regrouping|import (added|removed)/u);
});

test('Given the same basename without status evidence, when evidence is rendered, then it compares distinct file pairs', () => {
  const lines = linesOf(renamedSourcesOf([]));
  assert.ok(lines.includes('  - `src/new/client.ts` → `src/new/target.ts` — import added.'));
  assert.ok(lines.includes('  - `src/old/client.ts` → `src/old/target.ts` — import removed.'));
  assert.doesNotMatch(lines.join('\n'), /Proven path moves|Community regrouping/u);
});

test('Given incomplete base dependencies, when a head pair has no base evidence, then an addition remains unknown', () => {
  const sources = changedImportSourcesOf();
  assert.ok(sources.base.dependencies);
  const base = { ...sources.base, dependencies: { ...sources.base.dependencies, issues: [{ path: 'src/a/client.ts', reason: 'parse-error' as const }] } };
  const lines = linesOf({ ...sources, base });
  assert.match(lines.join('\n'), /Dependency evidence incomplete: base has 1 issue/u);
  assert.ok(lines.includes('  - `src/a/client.ts` → `src/b/target-00.ts` — comparison incomplete; import change unknown.'));
  assert.doesNotMatch(lines.join('\n'), /— import added/u);
});

test('Given incomplete head dependencies, when a base pair has no head evidence, then a removal remains unknown', () => {
  const sources = changedImportSourcesOf();
  assert.ok(sources.base.dependencies);
  const head = { ...sources.base, dependencies: { ...sources.base.dependencies, issues: [{ path: 'src/a/client.ts', reason: 'non-literal-dynamic' as const }] } };
  const lines = linesOf({ ...sources, base: sources.head, head });
  assert.ok(lines.includes('  - `src/a/client.ts` → `src/b/target-00.ts` — comparison incomplete; import change unknown.'));
  assert.doesNotMatch(lines.join('\n'), /— import removed/u);
});

test('Given a tool edge without observed dependency pairs, when evidence is rendered, then it does not claim zero imports', () => {
  const sources = changedImportSourcesOf();
  const head = { ...sources.head, dependencies: { version: 1 as const, pairs: [], issues: [] } };
  const text = linesOf({ ...sources, head }).join('\n');
  assert.match(text, /No file-pair evidence for this tool edge/u);
  assert.doesNotMatch(text, /0 deduplicated/u);
});

test('Given a split with unmatched community identity, when an unchanged import crosses a new edge, then it states the identity limit', () => {
  const pair = dependencyPairOf('src/a.ts', 'src/b.ts');
  const base = evidenceSnapshotOf({ mixed: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'] }, [pair]);
  const head = evidenceSnapshotOf({ first: ['src/a.ts'], second: ['src/b.ts'], third: ['src/c.ts'], fourth: ['src/d.ts'] }, [pair]);
  const text = linesOf({ base, head, touched: [] }).join('\n');
  assert.match(text, /unchanged import; community identity unmatched/u);
  assert.doesNotMatch(text, /— import added|### Community regrouping/u);
});

test('Given twelve pairs in reverse order with duplicate evidence kinds, when evidence is rendered, then it deduplicates and prints ten sorted pairs', () => {
  const sources = changedImportSourcesOf(12);
  const dependencies = sources.head.dependencies;
  assert.ok(dependencies);
  const head = { ...sources.head, dependencies: { ...dependencies, pairs: [...dependencies.pairs].reverse().concat(dependencies.pairs[0]) } };
  const lines = linesOf({ ...sources, head });
  assert.ok(lines.includes('- alpha → beta · new: 17 tool references; 12 deduplicated file pairs.'));
  assert.equal(lines.filter((line) => line.includes('— import added.')).length, 10);
  assert.ok(lines.includes('  - 2 file pairs omitted.'));
});

test('Given changed labels and ids with matched members, when evidence is rendered, then it does not report community movement', () => {
  const sources = changedImportSourcesOf();
  const head = { ...sources.base, communities: sources.base.communities.map((community) => ({ ...community, id: `new-${community.id}`, label: `new-${community.label}` })) };
  assert.doesNotMatch(linesOf({ ...sources, head }).join('\n'), /### Community regrouping/u);
});

test('Given missing base evidence and known head resolution issues, when evidence is rendered, then it preserves both limits and escapes issue text', () => {
  const sources = changedImportSourcesOf();
  assert.ok(sources.head.dependencies);
  const head = { ...sources.head, dependencies: { ...sources.head.dependencies, issues: [{ path: 'src/a/client.ts', specifier: './<unknown>&\nnext', reason: 'unresolved-local' as const }] } };
  const text = linesOf({ ...sources, base: { ...sources.base, dependencies: undefined }, head }).join('\n');
  assert.match(text, /Import explanations unavailable: base snapshot has no dependency data/u);
  assert.ok(text.includes('- head: <code>src/a/client.ts</code> → <code>./&lt;unknown&gt;&amp;\\nnext</code> — unresolved-local.'));
  assert.doesNotMatch(text, /— import added/u);
});


test('Given both import endpoints moved and one community regrouped, when edge evidence is rendered, then proven moves preserve the import pair', () => {
  const lines = linesOf(movedAndRegroupedSourcesOf());
  assert.ok(lines.includes('  - `src/a/client.ts` → `src/b/moved.ts` — unchanged import; community regrouping.'));
  assert.ok(lines.includes('  - `src/new/client.ts` → `src/new/moved.ts` — unchanged import; community regrouping.'));
  assert.ok(lines.includes('- `src/a/client.ts` → `src/new/client.ts`.'));
  assert.ok(lines.includes('- `src/b/moved.ts` → `src/new/moved.ts`.'));
  assert.ok(lines.includes('- `src/new/moved.ts`: beta → gamma.'));
  assert.doesNotMatch(lines.join('\n'), /— import (?:added|removed)/u);
});

test('Given different import kinds for the same normalized pair, when communities regroup, then it reports the pair as unchanged', () => {
  const sources = regroupedSourcesOf();
  assert.ok(sources.head.dependencies);
  const head = { ...sources.head, dependencies: { ...sources.head.dependencies, pairs: sources.head.dependencies.pairs.map((pair) => ({ ...pair, kinds: ['type' as const] })) } };
  const text = linesOf({ ...sources, head }).join('\n');
  assert.match(text, /unchanged import; community regrouping/u);
  assert.match(text, /evidence kinds can differ/u);
  assert.doesNotMatch(text, /— import (?:added|removed)/u);
});

test('Given a retained file that leaves an unmatched community, when evidence is rendered, then it discloses the missing head community identity', () => {
  const base = evidenceSnapshotOf({ old: ['src/a.ts'] }, []);
  const head = { ...base, communities: [] };
  const lines = linesOf({ base, head, touched: [] });
  assert.ok(lines.includes('### Unmatched community identity'));
  assert.ok(lines.includes('- `src/a.ts`: old → (no community).'));
});
