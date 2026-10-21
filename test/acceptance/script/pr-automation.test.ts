import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

const { mergeReviewedCandidate } = await import(new URL('automation-gate.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/automation-gate.ts');
type Evidence = import('../../../script/pr-review/automation-model.ts').MergeEvidence;

test('Given the workflow plain Node entry point and no activation, when it starts, then all imports load and merging stays disabled', async (t) => {
  const script = fileURLToPath(new URL('automation-merge.ts', pathToFileURL(prReviewCheckScript)));
  const result = await runScript(t, script);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Automatic merging is disabled/);
});

function candidate(): Evidence {
  return {
    enabled: true, head: 'a'.repeat(40), base: 'b'.repeat(40), paths: [], author: 'author', draft: false,
    state: 'open', mergeable: true, held: false, defaultBranch: true,
    assessment: { candidate: 'a'.repeat(40), mergeBase: 'b'.repeat(40), tier: 'T0', eligibility: 'eligible', blockers: [] },
    validation: { trusted: true, passed: true },
    checks: [{ name: 'candidate-validation', status: 'completed', conclusion: 'success' }],
    reviews: [], team: ['reviewer'], architects: ['architect'],
  };
}

test('Given a current T0 Auto merge candidate with trusted passing checks, when the gate runs, then it merges that exact commit without human approval', async () => {
  const merges: string[] = [];
  const result = await mergeReviewedCandidate({
    inspect: async () => candidate(),
    merge: async (sha) => { merges.push(sha); },
  });
  assert.equal(result.eligibility, 'eligible');
  assert.equal(result.tierName, 'T0 Auto merge');
  assert.deepEqual(merges, ['a'.repeat(40)]);
});

test('Given a passing candidate, when its head changes before merge, then the gate does not merge the replacement', async () => {
  let reads = 0;
  let merged = false;
  const result = await mergeReviewedCandidate({
    inspect: async () => ++reads === 1 ? candidate() : { ...candidate(), head: 'c'.repeat(40) },
    merge: async () => { merged = true; },
  });
  assert.equal(result.eligibility, 'blocked');
  assert.equal(merged, false);
});

test('Given a passing candidate, when a hold is added before merge, then the gate preserves the hold', async () => {
  let reads = 0;
  const result = await mergeReviewedCandidate({
    inspect: async () => ({ ...candidate(), held: ++reads > 1 }),
    merge: async () => assert.fail('The held candidate must not merge.'),
  });
  assert.equal(result.eligibility, 'blocked');
  assert.match(result.blockers.join('\n'), /hold/);
});

test('Given a candidate assessment, when its tier changes before merge, then it needs a fresh gate run', async () => {
  let reads = 0;
  const result = await mergeReviewedCandidate({
    inspect: async () => {
      const value = candidate();
      return ++reads === 1 ? value : { ...value, assessment: { ...value.assessment, tier: 'T1' }, reviews: [{ login: 'reviewer', type: 'User', state: 'APPROVED', head: value.head, submittedAt: '2026-10-21T20:00:00Z' }] };
    },
    merge: async () => assert.fail('Changed assessment must be reviewed by a new gate run.'),
  });
  assert.equal(result.eligibility, 'blocked');
});

test('Given a decision record change with current architect approval, when automatic merging runs, then only the owner may merge it manually', async () => {
  const value = candidate();
  const result = await mergeReviewedCandidate({
    inspect: async () => ({
      ...value,
      paths: ['architecture/decisions/2026-10-21-example.md'],
      assessment: { ...value.assessment, tier: 'T2' },
      reviews: [{ login: 'architect', type: 'User', state: 'APPROVED', head: value.head, submittedAt: '2026-10-21T20:00:00Z' }],
    }),
    merge: async () => assert.fail('A decision record change needs manual owner merge.'),
  });
  assert.equal(result.eligibility, 'blocked');
  assert.equal(result.tierName, 'T2 Need architect');
  assert.match(result.blockers.join('\n'), /manual owner merge/);
});
