import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { combineAssessments, escalationFromEvents, externalAssessment } = await import(new URL('automation-evidence.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-evidence.ts');
type Assessment = import('../../../script/pr-review/automation-model.ts').Assessment;
const local: Assessment = { candidate: 'a'.repeat(40), mergeBase: 'b'.repeat(40), tier: 'T1', eligibility: 'blocked', blockers: [{ key: 'evidence.process', fact: 'required' }] };

test('Given an architect escalation that the author later removes, when the event history is checked, then it still requires an architect', () => {
  assert.deepEqual(escalationFromEvents([
    { event: 'labeled', label: { name: 'T2 Need architect' }, created_at: '2026-10-21T20:00:00Z' },
    { event: 'unlabeled', label: { name: 'T2 Need architect' }, created_at: '2026-10-21T21:00:00Z' },
    { event: 'labeled', label: { name: 'T0 Auto merge' }, created_at: '2026-10-21T21:01:00Z' },
  ]), { tier: 'T2', after: '2026-10-21T20:00:00Z' });
});

test('Given an external assessment from the configured App, when head and base match, then it can supply missing metric evidence', () => {
  const external = { ...local, eligibility: 'eligible', blockers: [] } as const;
  assert.deepEqual(combineAssessments(local, external).blockers, []);
  assert.equal(combineAssessments(local, external).eligibility, 'eligible');
});

test('Given an external pass, when a static dependency blocker exists, then it cannot waive it', () => {
  const external = { ...local, eligibility: 'eligible', blockers: [] } as const;
  const combined = combineAssessments({ ...local, blockers: [...local.blockers, { key: 'dependency_graph.forbidden_edge', fact: 'a -> b' }] }, external);
  assert.equal(combined.eligibility, 'blocked');
  assert.equal(combined.blockers[0]?.key, 'dependency_graph.forbidden_edge');
});

test('Given an external report with a lower tier or another commit, when evidence is combined, then it is refused', () => {
  assert.throws(() => combineAssessments(local, { ...local, tier: 'T0', eligibility: 'eligible', blockers: [] }), /tier/);
  assert.throws(() => combineAssessments(local, { ...local, candidate: 'c'.repeat(40), eligibility: 'eligible', blockers: [] }), /candidate/);
});

test('Given a check with the right name but the wrong App or non-success result, when external evidence is read, then it is refused', () => {
  const report = { version: 1, baseTip: local.mergeBase, assessment: { ...local, eligibility: 'eligible', blockers: [] } };
  const check = { name: 'thermus/required-gates', head_sha: local.candidate, status: 'completed', conclusion: 'success', app: { id: 42, slug: 'trusted-checks' }, output: { text: JSON.stringify(report) } };
  assert.equal(externalAssessment([check], { appId: 42, head: local.candidate, baseTip: local.mergeBase }).tier, 'T1');
  assert.throws(() => externalAssessment([check], { appId: 43, head: local.candidate, baseTip: local.mergeBase }), /trusted/);
  assert.throws(() => externalAssessment([{ ...check, conclusion: 'skipped' }], { appId: 42, head: local.candidate, baseTip: local.mergeBase }), /trusted/);
  assert.throws(() => externalAssessment([{ ...check, app: { id: 42, slug: 'github-actions' } }], { appId: 42, head: local.candidate, baseTip: local.mergeBase }), /trusted/);
});
