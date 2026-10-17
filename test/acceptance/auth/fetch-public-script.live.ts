import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proveFirstPartyFetchScript } from '../../support/hosted-live/fetch-public-script-proof.ts';

test('Given a first-party Public Staging client, when the actual fetch script logs in, reuses and refreshes its grant, then real rendered fetch works and logout removes only local credentials', { timeout: 660_000 }, async (t) => {
  const evidence = await proveFirstPartyFetchScript((message) => t.diagnostic(message));
  t.diagnostic(JSON.stringify(evidence));
  assert.equal(evidence.actualScript, true);
  assert.equal(evidence.renderedFetch, true);
  assert.equal(evidence.savedReuse, true);
  assert.equal(evidence.refreshAfterExpiry, true);
  assert.equal(evidence.freshLogin, true);
  assert.equal(evidence.localOnlyLogout, true);
});
