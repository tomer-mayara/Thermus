import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/manual-history.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/manual-history.ts')>;
function history() {
  const ref = { id: '__proto__', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
  const expected = { unit: { id: 'unit-1', kind: 'file' as const }, basis: 'a'.repeat(64), start: 'b'.repeat(40), mainCut: 'c'.repeat(40), archiveCut: ref, scopeId: 'scope', reviewer: 'Owner', acceptedBest: 'd'.repeat(40), sources: [ref] };
  const input = { unit: expected.unit, basis: expected.basis, start: expected.start, mainCut: expected.mainCut, archiveCut: ref, scopeId: expected.scopeId, metric: 'MI', origin: { state: 'present-at-start', references: [ref] }, acceptedBest: { revision: expected.acceptedBest, evidence: { state: 'known', raw: 96 }, references: [ref] }, skippedRanges: [], gaps: [], review: { reviewer: expected.reviewer, completeness: 'no-known-gaps', statement: 'Reviewed the declared scope.' }, exceptions: [] };
  return { ref, expected, input, sources: [{ id: ref.id, bytes: new Uint8Array([97, 98, 99]) }] };
}
const h = history();
for (const [expected, field] of [
  [null, 'expected'], [{ ...h.expected, version: 1 }, 'expected.version'],
  [{ ...h.expected, unit: { id: ' ', kind: 'file' } }, 'expected.unit.id'],
  [{ ...h.expected, unit: { id: 'u', kind: 'package' } }, 'expected.unit.kind'],
  [{ ...h.expected, basis: h.expected.basis + '\n' }, 'expected.basis'],
  [{ ...h.expected, start: 'B'.repeat(40) }, 'expected.start'],
  [{ ...h.expected, mainCut: 'short' }, 'expected.mainCut'],
  [{ ...h.expected, acceptedBest: null }, 'expected.acceptedBest'],
  [{ ...h.expected, scopeId: '' }, 'expected.scopeId'],
  [{ ...h.expected, reviewer: ' ' }, 'expected.reviewer'],
  [{ ...h.expected, sources: [h.ref, h.ref] }, 'expected.sources[1].id'],
  [{ ...h.expected, sources: [] }, 'expected.archiveCut'],
] as const) {
  test(`Given invalid expected binding at ${field}, when history is read, then the independent expectation is rejected`, async () => {
    const { manualHistoryIn } = await load();
    assert.throws(() => manualHistoryIn(h.input, expected as Parameters<typeof manualHistoryIn>[1], h.sources), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid manual history at ${field}:`));
  });
}

for (const [sources, field] of [
  [null, 'sources'], [[{ ...h.sources[0], bytes: null }], 'sources[0].bytes'],
  [[h.sources[0], h.sources[0]], 'sources[1].id'],
  [[{ id: 'not-allowed', bytes: h.sources[0].bytes }], 'sources[0].id'],
  [[{ ...h.sources[0], bytes: new Uint8Array([97, 98, 99, 10]) }], 'sources[0].bytes'],
  [Array(1), 'sources[0]'],
] as const) {
  test(`Given invalid retained sources at ${field}, when history is read, then supplied bytes cannot become an ordinary gap`, async () => {
    const { manualHistoryIn } = await load();
    assert.throws(() => manualHistoryIn(h.input, h.expected, sources as unknown as Parameters<typeof manualHistoryIn>[2]), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid manual history at ${field}:`));
  });
}

for (const [input, field] of [
  [null, 'input'], [{ ...h.input, version: 1 }, 'input.version'],
  [{ ...h.input, unit: { id: 'other', kind: 'file' } }, 'input.unit'],
  [{ ...h.input, basis: 'e'.repeat(64) }, 'input.basis'],
  [{ ...h.input, start: h.expected.mainCut }, 'input.start'],
  [{ ...h.input, mainCut: h.expected.start }, 'input.mainCut'],
  [{ ...h.input, scopeId: 'other' }, 'input.scopeId'],
  [{ ...h.input, metric: 'CRAP' }, 'input.metric'],
  [{ ...h.input, archiveCut: { ...h.ref, sha256: 'e'.repeat(64) } }, 'input.archiveCut'],
  [{ ...h.input, origin: { state: 'missing', reason: ' ' } }, 'input.origin.reason'],
  [{ ...h.input, origin: { state: 'present-at-start', references: [] } }, 'input.origin.references'],
  [{ ...h.input, origin: { state: 'present-at-start', references: [h.ref, h.ref] } }, 'input.origin.references[1].id'],
  [{ ...h.input, origin: { state: 'introduced', revision: 'bad', references: [h.ref] } }, 'input.origin.revision'],
  [{ ...h.input, acceptedBest: { ...h.input.acceptedBest, revision: h.expected.mainCut } }, 'input.acceptedBest.revision'],
  [{ ...h.input, acceptedBest: { ...h.input.acceptedBest, references: [] } }, 'input.acceptedBest.references'],
  [{ ...h.input, acceptedBest: { ...h.input.acceptedBest, evidence: { state: 'known', raw: null } } }, 'input.acceptedBest.evidence.raw'],
  [{ ...h.input, acceptedBest: { ...h.input.acceptedBest, evidence: { state: 'missing', reason: 'Unavailable', raw: 0 } } }, 'input.acceptedBest.evidence.raw'],
  [{ ...h.input, review: { ...h.input.review, reviewer: 'Other' } }, 'input.review.reviewer'],
  [{ ...h.input, review: { ...h.input.review, statement: '' } }, 'input.review.statement'],
  [{ ...h.input, review: { ...h.input.review, references: [h.ref] } }, 'input.review.references'],
  [{ ...h.input, review: { ...h.input.review, completeness: 'gaps-declared' } }, 'input.review.completeness'],
  [{ ...h.input, exceptions: undefined }, 'input.exceptions'],
  [{ ...h.input, gaps: Array(1) }, 'input.gaps[0]'],
] as const) {
  test(`Given invalid declaration at ${field}, when history is read, then unsupported or contradictory data is rejected`, async () => {
    const { manualHistoryIn } = await load();
    assert.throws(() => manualHistoryIn(input, h.expected, h.sources), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid manual history at ${field}:`));
  });
}

test('Given retained Uint8Array view bytes, when their digest is checked, then only byteOffset and byteLength contribute and no bytes escape', async () => {
  const { manualHistoryIn } = await load();
  const bytes = new Uint8Array([0, 97, 98, 99, 255]).subarray(1, 4);
  assert.deepEqual(manualHistoryIn(h.input, h.expected, [{ id: h.ref.id, bytes }]), h.input);
});

test('Given a catalog allowance without bytes, when it is unused or referenced, then only an actual reference requires retained bytes', async () => {
  const { manualHistoryIn } = await load();
  const extra = { id: 'other', sha256: h.ref.sha256 };
  const expected = { ...h.expected, sources: [h.ref, extra] };
  assert.deepEqual(manualHistoryIn(h.input, expected, h.sources), h.input);
  assert.throws(() => manualHistoryIn({ ...h.input, origin: { state: 'present-at-start', references: [extra] } }, expected, h.sources), /input.origin.references\[0\]/);
  assert.throws(() => manualHistoryIn(h.input, expected, [...h.sources, { id: extra.id, bytes: new Uint8Array([0]) }]), /sources\[1\].bytes/);
});

test('Given a reference with an unapproved hash, when its bytes exist, then the independently pinned catalog still rejects substitution', async () => {
  const { manualHistoryIn } = await load();
  assert.throws(() => manualHistoryIn({ ...h.input, origin: { state: 'present-at-start', references: [{ ...h.ref, sha256: 'f'.repeat(64) }] } }, h.expected, h.sources), /input.origin.references\[0\]/);
});

test('Given no selected best reference, when history is read, then missing best stays explicit and requires a gaps declaration', async () => {
  const { manualHistoryIn } = await load();
  const expected = { ...h.expected, acceptedBest: undefined };
  const input = { ...h.input, acceptedBest: { state: 'missing', reason: 'Best reference is unresolved.' }, review: { ...h.input.review, completeness: 'gaps-declared' } };
  assert.deepEqual(manualHistoryIn(input, expected, h.sources), input);
  assert.throws(() => manualHistoryIn(h.input, expected, h.sources), /input.acceptedBest/);
  assert.throws(() => manualHistoryIn({ ...input, review: h.input.review }, expected, h.sources), /input.review.completeness/);
});

test('Given selected revision with missing measurement, when read, then empty references are allowed but supplied bad references still fail', async () => {
  const { manualHistoryIn } = await load();
  const input = { ...h.input, acceptedBest: { revision: h.expected.acceptedBest, evidence: { state: 'missing', reason: 'Measurement is unavailable.' }, references: [] }, review: { ...h.input.review, completeness: 'gaps-declared' } };
  assert.deepEqual(manualHistoryIn(input, h.expected, h.sources), input);
  assert.throws(() => manualHistoryIn({ ...input, acceptedBest: { ...input.acceptedBest, references: [{ id: 'unknown', sha256: h.ref.sha256 }] } }, h.expected, h.sources), /input.acceptedBest.references\[0\]/);
});

for (const raw of [NaN, Infinity, -Infinity, undefined]) {
  test(`Given invalid raw MI ${String(raw)}, when history contains a selected best, then it is not a missing measurement`, async () => {
    const { manualHistoryIn } = await load();
    assert.throws(() => manualHistoryIn({ ...h.input, acceptedBest: { ...h.input.acceptedBest, evidence: { state: 'known', raw } } }, h.expected, h.sources), /input.acceptedBest.evidence.raw/);
  });
}

for (const raw of [-Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]) {
  test(`Given finite raw class MI ${raw}, when history is read, then full raw precision is retained`, async () => {
    const { manualHistoryIn } = await load();
    const expected = { ...h.expected, unit: { id: 'class-1', kind: 'class' as const } };
    const input = { ...h.input, unit: expected.unit, acceptedBest: { ...h.input.acceptedBest, evidence: { state: 'known', raw } } };
    assert.deepEqual(manualHistoryIn(input, expected, h.sources), input);
  });
}

test('Given introduced origin or missing origin, when read, then declarations remain explicit without inferred ancestry', async () => {
  const { manualHistoryIn } = await load();
  const introduced = { ...h.input, origin: { state: 'introduced', revision: h.expected.mainCut, references: [h.ref] } };
  assert.deepEqual(manualHistoryIn(introduced, h.expected, h.sources), introduced);
  const missing = { ...h.input, origin: { state: 'missing', reason: 'Continuity needs review.' }, review: { ...h.input.review, completeness: 'gaps-declared' } };
  assert.deepEqual(manualHistoryIn(missing, h.expected, h.sources), missing);
  assert.throws(() => manualHistoryIn({ ...missing, review: h.input.review }, h.expected, h.sources), /input.review.completeness/);
});

test('Given repeated or conflicting endpoint pairs, when read, then duplicates fail without inferring order from commit hashes', async () => {
  const { manualHistoryIn } = await load();
  const range = { from: h.expected.mainCut, through: h.expected.start, reason: 'Manually reviewed.', references: [h.ref] };
  assert.deepEqual(manualHistoryIn({ ...h.input, skippedRanges: [range] }, h.expected, h.sources).skippedRanges, [range]);
  assert.throws(() => manualHistoryIn({ ...h.input, skippedRanges: [range, range] }, h.expected, h.sources), /input.skippedRanges\[1\]/);
  const gap = { from: range.from, through: range.through, reason: 'Unavailable.' };
  assert.throws(() => manualHistoryIn({ ...h.input, gaps: [gap, gap], review: { ...h.input.review, completeness: 'gaps-declared' } }, h.expected, h.sources), /input.gaps\[1\]/);
  assert.throws(() => manualHistoryIn({ ...h.input, skippedRanges: [range], gaps: [gap], review: { ...h.input.review, completeness: 'gaps-declared' } }, h.expected, h.sources), /input.gaps\[0\]/);
});

test('Given inherited mandatory fields, when read, then own declarations and bindings are required', async () => {
  const { manualHistoryIn } = await load();
  assert.throws(() => manualHistoryIn(Object.create(h.input), h.expected, h.sources), /input.unit/);
  assert.throws(() => manualHistoryIn(h.input, Object.create(h.expected), h.sources), /expected.sources/);
});

test('Given frozen declarations, when copied, then unit, evidence, references, arrays and review records do not alias input', async () => {
  const { manualHistoryIn } = await load();
  const input = history().input;
  Object.freeze(input.unit); Object.freeze(input.acceptedBest.evidence); Object.freeze(input.acceptedBest.references); Object.freeze(input.acceptedBest); Object.freeze(input.review); Object.freeze(input);
  const result = manualHistoryIn(input, h.expected, h.sources);
  assert.deepEqual(result, input);
  assert.notEqual(result.unit, input.unit); assert.notEqual(result.review, input.review); assert.notEqual(result.acceptedBest, input.acceptedBest);
  assert.ok('evidence' in result.acceptedBest);
  assert.notEqual(result.acceptedBest.evidence, input.acceptedBest.evidence); assert.notEqual(result.acceptedBest.references, input.acceptedBest.references); assert.notEqual(result.acceptedBest.references[0], input.acceptedBest.references[0]);
});


for (const [paths, share] of [[6, 0], [Number.MAX_SAFE_INTEGER, 1e-320]] as const) {
  test(`Given selected CRAP paths ${paths} and share ${share}, when read, then known coverage is retained and copied without display arithmetic`, async () => {
    const { manualHistoryIn } = await load();
    const expected = { ...h.expected, unit: { id: 'function-1', kind: 'function' as const } };
    const coverage = Object.freeze({ state: 'known', share });
    const input = { ...h.input, unit: expected.unit, metric: 'CRAP', acceptedBest: { ...h.input.acceptedBest, evidence: { state: 'known', paths, coverage } } };
    const result = manualHistoryIn(input, expected, h.sources);
    assert.deepEqual(result, input);
    assert.ok('evidence' in result.acceptedBest && 'paths' in result.acceptedBest.evidence);
    assert.notEqual(result.acceptedBest.evidence.coverage, coverage);
  });
}

for (const [evidence, field] of [
  [{ state: 'known', paths: -1, coverage: { state: 'known', share: 1 } }, 'input.acceptedBest.evidence'],
  [{ state: 'known', paths: Number.MAX_SAFE_INTEGER + 1, coverage: { state: 'known', share: 1 } }, 'input.acceptedBest.evidence'],
  [{ state: 'known', paths: 3, coverage: { state: 'known', share: null } }, 'input.acceptedBest.evidence.coverage.share'],
  [{ state: 'known', paths: 3, coverage: { state: 'known', share: NaN } }, 'input.acceptedBest.evidence.coverage.share'],
  [{ state: 'known', paths: 3, coverage: { state: 'known', share: 1.1 } }, 'input.acceptedBest.evidence.coverage.share'],
  [{ state: 'known', paths: 3, coverage: { state: 'known', share: 0, reason: 'Contradiction' } }, 'input.acceptedBest.evidence.coverage.reason'],
] as const) {
  test(`Given malformed selected CRAP evidence at ${field}, when read, then the manual boundary rejects invalid supplied data`, async () => {
    const { manualHistoryIn } = await load();
    const expected = { ...h.expected, unit: { id: 'function-1', kind: 'function' as const } };
    const input = { ...h.input, unit: expected.unit, metric: 'CRAP', acceptedBest: { ...h.input.acceptedBest, evidence } };
    assert.throws(() => manualHistoryIn(input, expected, h.sources), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid manual history at ${field}:`));
  });
}
