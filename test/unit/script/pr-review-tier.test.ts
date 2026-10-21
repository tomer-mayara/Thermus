import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { tierOf, labelCommand, orderedReasons } = await import(new URL('tier.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/tier.ts');

test('Given independent blockers and review reasons, when the tier is selected, then blockers never hide the highest review requirement', () => {
  assert.equal(tierOf([{ tier: 'T2', key: 'contract', fact: 'A changed contract.' }, { blocking: true, key: 'tests', fact: 'Failed.' }]), 'T2');
  assert.equal(tierOf([{ tier: 'T1', key: 'policy', fact: 'A changed rule.' }, { blocking: true, key: 'tests', fact: 'Failed.' }]), 'T1');
  assert.equal(tierOf([]), 'T0');
});

test('Given a tier and repository, when a label command is shown, then its full canonical name is safely quoted', () => {
  assert.match(labelCommand('T1', 'owner/name'), /--add-label 'T1 Team review'/);
  assert.match(labelCommand('T1', 'owner/name'), /--remove-label 'T0 Auto merge'/);
  assert.match(labelCommand('T1', 'owner/name'), /--remove-label 'T2 Need architect'/);
});

test('Given reasons in mixed order, when they are reported, then all blockers and review reasons are retained', () => {
  const reasons = [{ tier: 'T1' as const, key: 'local', fact: 'Local.' }, { blocking: true as const, key: 'failure', fact: 'Failure.' }, { tier: 'T2' as const, key: 'contract', fact: 'Contract.' }];
  assert.deepEqual(orderedReasons(reasons).map((reason) => reason.key), ['failure', 'contract', 'local']);
});
