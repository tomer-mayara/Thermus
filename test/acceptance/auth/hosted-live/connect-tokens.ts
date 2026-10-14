import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { requestMachineTokens, refreshConnectTokens, issuedTokens } from '../../../support/hosted-live/connect-client.ts';
import { once, type LiveRun } from '../../../support/hosted-live/live-run.ts';
import { authkitKeySetUrl, mcpResource } from '../../../support/hosted-live/settings.ts';
import { errorCode, readToken, secondsLeft, tokenRecord } from '../../../support/hosted-live/tokens.ts';
import { deleteWorkOSResource, field, readWorkOSList } from '../../../support/hosted-live/workos-api.ts';

const tokenOptions = { timeout: 180_000 };

export function describeConnectTokenProofs(run: LiveRun): void {
  const { settings } = run;
  const authkitKeys = createRemoteJWKSet(new URL(authkitKeySetUrl(settings.authkitIssuer)));
  // The checks of the MCP verifier: the exact AuthKit issuer, the MCP resource in the audience, and RS256 only.
  const verifyAsMcpToken = (token: string) => jwtVerify(token, authkitKeys, { issuer: settings.authkitIssuer, audience: mcpResource, algorithms: ['RS256'] });
  // The refresh comes before the consent revocation, so both tests can share the grant.
  const refreshed = once(async () => {
    const { tokens, clientId } = await run.connectGrant();
    assert.ok(tokens.refreshToken, 'The Connect grant has no refresh token.');
    const answer = await refreshConnectTokens(settings.authkitIssuer, clientId, { refreshToken: tokens.refreshToken, resource: mcpResource });
    return { previous: tokens, next: issuedTokens(answer, 'The Connect refresh') };
  });

  describe('Hosted live proofs: Connect tokens, their refresh, and their end', () => {
    test('Given a Connect grant with a refresh token, when the client refreshes it with the MCP resource, then the new access token has the same user, consent sid, organization, client, and audience, and the answer shows whether WorkOS rotated the refresh token', tokenOptions, async (t) => {
      const { previous, next } = await refreshed();
      const before = readToken(previous.accessToken);
      const after = readToken(next.accessToken);
      t.diagnostic(`refreshed Connect access token: ${tokenRecord(after)}`);
      t.diagnostic(`refresh token rotated: ${String(next.refreshToken !== undefined && next.refreshToken !== previous.refreshToken)}; refresh token in the answer: ${next.refreshToken === undefined ? 'absent' : 'present'}`);

      for (const claim of ['sub', 'sid', 'org_id', 'client_id', 'aud', 'iss']) assert.deepEqual(after.claims[claim], before.claims[claim], `The refresh changed the ${claim} claim.`);
      await verifyAsMcpToken(next.accessToken);
    });

    test('Given a browser access token of the environment client, when it is checked with the checks of the MCP verifier, then it is refused, because its issuer is not the AuthKit issuer and it has no MCP audience', tokenOptions, async (t) => {
      const { exchange } = await run.newUserSignIn();
      const failure = await verifyAsMcpToken(exchange.accessToken).then(() => undefined, (error: unknown) => error);
      t.diagnostic(`browser token as an MCP token: ${errorCode(failure)}`);

      assert.ok(failure instanceof Error, 'The MCP checks accepted a browser access token.');
    });

    test('Given an M2M application of Connect, when it gets a client_credentials token for the MCP resource, then the token has no sid and its sub equals its client_id, and the checks of the MCP verifier refuse it or only the sid and sub rule can refuse it', tokenOptions, async (t) => {
      const { machineApplication } = await run.fixtures();
      const answer = await requestMachineTokens(settings.authkitIssuer, machineApplication, mcpResource);
      const machine = readToken(issuedTokens(answer, 'The M2M token request').accessToken);
      t.diagnostic(`M2M access token: ${tokenRecord(machine)}`);
      const failure = await verifyAsMcpToken(issuedTokens(answer, 'The M2M token request').accessToken).then(() => undefined, (error: unknown) => error);
      t.diagnostic(`M2M token as an MCP token: ${failure === undefined ? 'accepted by the jose checks' : errorCode(failure)}`);

      assert.equal(machine.claims.sid, undefined);
      assert.equal(machine.claims.sub, machine.claims.client_id);
      assert.equal(machine.claims.client_id, machineApplication.clientId);
    });

    test('Given a Connect grant, when the operator deletes the authorized application of the user, then the refresh token gives invalid_grant, and the issued access token still verifies until it expires', tokenOptions, async (t) => {
      const { connectUser, oauthApplication } = await run.fixtures();
      const { next } = await refreshed();
      const issued = readToken(next.accessToken);
      const path = `/user_management/users/${connectUser.id}/authorized_applications`;
      const authorizations = await readWorkOSList(settings, path);
      const applications = authorizations.map((authorization) => field(authorization, 'application'));
      t.diagnostic(`authorized applications of the user: ${authorizations.map((authorization) => `${String(authorization.object)} for ${String(authorization.oauth_resource)} with ${JSON.stringify(authorization.granted_scopes)}`).join(', ')}`);
      assert.deepEqual(applications.map(({ id }) => id), [oauthApplication.id], 'The user has not exactly the one authorized MCP client.');

      const status = await deleteWorkOSResource(settings, `${path}/${oauthApplication.id}`);
      assert.ok(status >= 200 && status < 300, `The deletion of the authorized application gave HTTP ${status}.`);
      assert.ok(next.refreshToken, 'The refreshed grant has no refresh token.');
      const refresh = await refreshConnectTokens(settings.authkitIssuer, issued.claims.client_id as string, { refreshToken: next.refreshToken, resource: mcpResource });
      t.diagnostic(`refresh after the consent revocation: HTTP ${refresh.status} ${String(refresh.body.error)}`);
      await verifyAsMcpToken(next.accessToken);
      t.diagnostic(`the access token issued before the revocation verifies for ${secondsLeft(issued)} more seconds of its ${String(issued.lifetime)}-second lifetime`);

      assert.equal(refresh.status, 400);
      assert.equal(refresh.body.error, 'invalid_grant');
      assert.ok(secondsLeft(issued) > 0, 'The access token had already expired.');
    });
  });
}
