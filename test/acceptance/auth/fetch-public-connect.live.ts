import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proveFirstPartyConnect } from '../../support/hosted-live/fetch-public-connect-proof.ts';

test('Given a Staging first-party Public Connect client and an owned user, when browser PKCE reaches the real loopback callback and refreshes, then the MCP backend accepts its resource-bound workspace grant', { timeout: 240_000 }, async (t) => {
  const evidence = await proveFirstPartyConnect();
  t.diagnostic(JSON.stringify(evidence));
  assert.equal(evidence.callbackReachedListener, true);
  assert.deepEqual(evidence.scope.split(' ').sort(), ['offline_access', 'openid']);
  assert.equal(evidence.refreshPresent, true);
  assert.equal(evidence.initialMcpStatus, 200);
  assert.equal(evidence.refreshedMcpStatus, 200);
  assert.equal(evidence.removedMembershipMcpStatus, 403);
});
