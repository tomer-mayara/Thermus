import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChangeRecording, UnconfirmedChangeError } from '../../../src/accounts/organizations/change-records.ts';

const entry = { actor: { authority: 'provider', subject: 'admin' }, organizationId: 'org-a', target: { email: 'new@example.com' }, action: 'invite' };

test('Given a completed directory write and a throwing recorder, when recording finishes, then the applied result stays complete and the write runs once', async () => {
  let writes = 0;
  let records = 0;
  const recording = new ChangeRecording({ record: () => { records++; throw new Error('record-only-private-cause'); } }, () => new Date());
  const result = await recording.run(entry, async () => async () => { writes++; return 'applied'; });
  assert.equal(result, 'applied');
  assert.equal(writes, 1);
  assert.equal(records, 1);
});

test('Given a failed check or unconfirmed directory write and a throwing recorder, when the change finishes, then the original failure and phase stay intact', async () => {
  const failure = new Error('provider failure');
  const recording = new ChangeRecording({ record: () => { throw new Error('record failure'); } }, () => new Date());
  await assert.rejects(recording.run(entry, async () => { throw failure; }), error => error === failure);
  await assert.rejects(recording.run(entry, async () => async () => { throw failure; }), error => error instanceof UnconfirmedChangeError && error.cause === failure);
});
