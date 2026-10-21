import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/manual-history.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/manual-history.ts')>;
function history() {
  const bytes = new Uint8Array([0, 255, 13, 10, 128]);
  const ref = { id: 'retained-record', sha256: createHash('sha256').update(bytes).digest('hex') };
  const expected = { unit: { id: 'unit-1', kind: 'file' as const }, basis: 'a'.repeat(64), start: 'b'.repeat(40), mainCut: 'c'.repeat(40), archiveCut: ref, scopeId: 'review-scope', reviewer: 'Owner', acceptedBest: 'd'.repeat(40), sources: [ref] };
  const input = { unit: expected.unit, basis: expected.basis, start: expected.start, mainCut: expected.mainCut, archiveCut: ref, scopeId: expected.scopeId, metric: 'MI', origin: { state: 'present-at-start', references: [ref] }, acceptedBest: { revision: expected.acceptedBest, evidence: { state: 'known', raw: 96 }, references: [ref] }, skippedRanges: [{ from: expected.start, through: expected.mainCut, reason: 'Reviewed changes do not affect this unit.', references: [ref] }], gaps: [], review: { reviewer: expected.reviewer, completeness: 'no-known-gaps', statement: 'I reviewed the declared scope and retained records.' }, exceptions: [] };
  return { input, expected, sources: [{ id: ref.id, bytes }] };
}

test('Given a manual MI history declaration and retained binary source bytes, when read against independent bindings, then facts and checked references are copied without creating an anchor or route', async () => {
  const { manualHistoryIn } = await load();
  const { input, expected, sources } = history();
  const result = manualHistoryIn(input, expected, sources);
  assert.deepEqual(result, input);
  assert.notEqual(result.unit, input.unit);
  assert.notEqual(result.acceptedBest, input.acceptedBest);
});

test('Given a declared best score and a relevant history gap, when read, then the gap and human completeness declaration remain visible beside the score', async () => {
  const { manualHistoryIn } = await load();
  const { input, expected, sources } = history();
  const gapped = { ...input, skippedRanges: [], gaps: [{ from: expected.start, through: expected.mainCut, reason: 'An intervening accepted measurement is unavailable.' }], review: { ...input.review, completeness: 'gaps-declared' } };
  assert.deepEqual(manualHistoryIn(gapped, expected, sources), gapped);
});

test('Given a history gap and retained bytes that differ from their expected digest, when read, then corrupt evidence is rejected rather than hidden by the gap', async () => {
  const { manualHistoryIn } = await load();
  const { input, expected, sources } = history();
  const gapped = { ...input, origin: { state: 'missing', reason: 'Origin needs review.' }, review: { ...input.review, completeness: 'gaps-declared' } };
  assert.throws(() => manualHistoryIn(gapped, expected, [{ ...sources[0], bytes: new Uint8Array([0, 255, 10, 128]) }]), /sources\[0\].bytes/);
});

test('Given supplied standing exceptions, when this bounded history reader is used, then unsupported obligations are rejected rather than silently dropped', async () => {
  const { manualHistoryIn } = await load();
  const { input, expected, sources } = history();
  assert.throws(() => manualHistoryIn({ ...input, exceptions: [{ id: 'EX-1' }] }, expected, sources), /input.exceptions/);
});

test('Given selected CRAP best evidence without coverage, when paths are positive or zero, then only zero can supply an exact declared best fact', async () => {
  const { manualHistoryIn } = await load();
  const { input, expected, sources } = history();
  const binding = { ...expected, unit: { id: 'function-1', kind: 'function' as const } };
  const candidate = { ...input, unit: binding.unit, metric: 'CRAP', acceptedBest: { ...input.acceptedBest, evidence: { state: 'known', paths: 3, coverage: { state: 'missing', reason: 'Coverage was not captured.' } } } };
  assert.throws(() => manualHistoryIn(candidate, binding, sources), /input.acceptedBest.evidence.coverage/);
  const zero = { ...candidate, acceptedBest: { ...candidate.acceptedBest, evidence: { ...candidate.acceptedBest.evidence, paths: 0 } } };
  assert.deepEqual(manualHistoryIn(zero, binding, sources), zero);
});
