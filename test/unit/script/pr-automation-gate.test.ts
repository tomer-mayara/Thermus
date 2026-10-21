import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { mergeReviewedCandidate } = await import(new URL('automation-gate.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-gate.ts');
type Evidence = import('../../../script/pr-review/automation-model.ts').MergeEvidence;

async function evaluateCandidate(evidence: Evidence) {
  const merged: string[] = [];
  const result = await mergeReviewedCandidate({
    inspect: async () => evidence,
    merge: async (head) => { merged.push(head); },
  });
  assert.deepEqual(merged, result.eligibility === 'eligible' ? [evidence.head] : []);
  return result;
}

function candidate(tier: 'T0' | 'T1' | 'T2' = 'T0'): Evidence {
  return {
    enabled: true, head: 'a'.repeat(40), base: 'b'.repeat(40), paths: [], author: 'author', draft: false,
    state: 'open', mergeable: true, held: false, defaultBranch: true,
    assessment: { candidate: 'a'.repeat(40), mergeBase: 'b'.repeat(40), tier, eligibility: 'eligible', blockers: [] },
    validation: { trusted: true, passed: true },
    checks: [{ name: 'candidate-validation', status: 'completed', conclusion: 'success' }],
    reviews: [], team: ['reviewer'], architects: ['architect'],
  };
}

for (const status of ['pending', 'queued', 'in_progress']) {
  test(`Given a ${status} required check, when merge eligibility is computed, then it is blocked`, async () => {
    assert.equal((await evaluateCandidate({ ...candidate(), checks: [{ name: 'required', status, conclusion: null }] })).eligibility, 'blocked');
  });
}
for (const conclusion of ['failure', 'skipped', 'cancelled', 'neutral', null]) {
  test(`Given a completed check with ${conclusion} conclusion, when merge eligibility is computed, then it is blocked`, async () => {
    assert.equal((await evaluateCandidate({ ...candidate(), checks: [{ name: 'required', status: 'completed', conclusion }] })).eligibility, 'blocked');
  });
}

test('Given a T2 Need architect change and a failed check, when the gate runs, then it keeps T2 Need architect and blocks merge', async () => {
  const result = await evaluateCandidate({ ...candidate('T2'), checks: [{ name: 'required', status: 'completed', conclusion: 'failure' }] });
  assert.equal(result.tierName, 'T2 Need architect');
  assert.equal(result.eligibility, 'blocked');
});

test('Given T1 Team review, when the latest independent current-head human review approves, then the candidate is eligible', async () => {
  const evidence = candidate('T1');
  assert.equal((await evaluateCandidate({ ...evidence, reviews: [{ login: 'reviewer', type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'eligible');
});

for (const reviewer of ['author', 'unlisted', 'reviewer']) {
  test(`Given T2 Need architect, when ${reviewer} approves without an independent architect approval, then it remains blocked`, async () => {
    const evidence = candidate('T2');
    assert.equal((await evaluateCandidate({ ...evidence, reviews: [{ login: reviewer, type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'blocked');
  });
}

test('Given T2 Need architect, when an allowlisted independent architect approves the current head, then that one approval is sufficient', async () => {
  const evidence = candidate('T2');
  assert.equal((await evaluateCandidate({ ...evidence, reviews: [{ login: 'architect', type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'eligible');
});

test('Given an old approval followed by changes requested, when the gate runs, then the old approval is not accepted', async () => {
  const evidence = candidate('T1');
  assert.equal((await evaluateCandidate({ ...evidence, reviews: [
    { login: 'reviewer', type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' },
    { login: 'reviewer', type: 'User', state: 'CHANGES_REQUESTED', head: evidence.head, submittedAt: '2026-10-21T21:00:00Z' },
  ] })).eligibility, 'blocked');
});

test('Given a stale or bot approval, when the gate runs, then it does not satisfy human review', async () => {
  const evidence = candidate('T1');
  for (const review of [
    { login: 'reviewer', type: 'User', head: 'c'.repeat(40) },
    { login: 'reviewer', type: 'Bot', head: evidence.head },
  ]) assert.equal((await evaluateCandidate({ ...evidence, reviews: [{ ...review, state: 'APPROVED', submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'blocked');
});

test('Given an untrusted or missing validation run, when all listed checks pass, then merge stays blocked', async () => {
  assert.equal((await evaluateCandidate({ ...candidate(), validation: { trusted: false, passed: true } })).eligibility, 'blocked');
  assert.equal((await evaluateCandidate({ ...candidate(), validation: { trusted: true, passed: false } })).eligibility, 'blocked');
});

test('Given an architect approval made before escalation, when the gate evaluates T2 Need architect, then fresh approval is needed', async () => {
  const evidence = candidate('T2');
  assert.equal((await evaluateCandidate({ ...evidence, reviewAfter: '2026-10-21T21:00:00Z', reviews: [{ login: 'architect', type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'blocked');
});

test('Given no candidate checks, when the gate evaluates merge, then absence is not a pass', async () => {
  assert.equal((await evaluateCandidate({ ...candidate(), checks: [] })).eligibility, 'blocked');
});

test('Given any independent human reviewer requests changes, when a T0 Auto merge candidate is checked, then it is blocked without granting that reviewer approval authority', async () => {
  const evidence = candidate();
  assert.equal((await evaluateCandidate({ ...evidence, reviews: [{ login: 'unlisted', type: 'User', state: 'CHANGES_REQUESTED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'blocked');
  assert.equal((await evaluateCandidate({ ...candidate('T1'), reviews: [{ login: 'unlisted', type: 'User', state: 'APPROVED', head: evidence.head, submittedAt: '2026-10-21T20:00:00Z' }] })).eligibility, 'blocked');
});
