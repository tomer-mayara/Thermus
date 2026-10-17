import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OauthException } from '@workos-inc/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { refreshedToken } from '../../../support/hosted-live/browser-session.ts';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { browserIssuer, browserRedirectUri } from '../../../support/hosted-live/settings.ts';
import { errorCode, readToken, sortedClaimList, tokenRecord } from '../../../support/hosted-live/tokens.ts';

const signInOptions = { timeout: 180_000 };
const sealedSessionLimit = 3_800;

export function describeBrowserSignInProofs(run: LiveRun): void {
  const { settings, workos } = run;
  const requiredMfa = settings.mfaPolicy === 'required';

  describe('Hosted live proofs: browser sign-in through hosted AuthKit', () => {
    test(requiredMfa
      ? 'Given a new user with a password and required MFA, when the user signs in through hosted AuthKit, then AuthKit asks for the MFA enrollment and sends no callback before the TOTP step; after it, the callback has a code and the request state, and the code exchange reports the Password method'
      : 'Given a new user with a password and Optional MFA, when the user signs in through hosted AuthKit, then the password reaches the callback without an MFA step, with the request state, and the code exchange reports Password without proving MFA', signInOptions, async (t) => {
      const { visit, stateMatches, exchange } = await run.newUserSignIn();
      t.diagnostic(`AuthKit pages before the callback: ${visit.pages.join(' > ')}`);
      t.diagnostic(`callback: ${visit.callback.origin}${visit.callback.pathname} with ${[...visit.callback.searchParams.keys()].join(', ')}`);
      t.diagnostic(`authentication method: ${String(exchange.authenticationMethod)}`);

      assert.ok(visit.pages.includes('/password'), 'AuthKit did not ask for the password.');
      if (requiredMfa) assert.ok(visit.pages.indexOf('/mfa/enrollment') > visit.pages.indexOf('/password'), 'AuthKit did not ask for the MFA enrollment after the password, before the callback.');
      else assert.ok(visit.pages.every((path) => !path.startsWith('/mfa/')), 'Optional MFA demanded an MFA step.');
      assert.equal(`${visit.callback.origin}${visit.callback.pathname}`, browserRedirectUri);
      assert.ok(stateMatches, 'The callback does not have the state of the authorization request.');
      assert.equal(exchange.authenticationMethod, 'Password');
    });

    test('Given the code of that sign-in, when the server exchanges it with PKCE and seals the session, then the access token is an RS256 browser token of the environment client with a session_ sid, no aud, no org_id, and a 300-second lifetime that verifies with the browser-session key set, and the sealed session is shorter than 3,800 characters', signInOptions, async (t) => {
      const { exchange, cookiePasswordLength } = await run.newUserSignIn();
      const token = readToken(exchange.accessToken);
      t.diagnostic(`browser access token: ${tokenRecord(token)}`);
      t.diagnostic(`sealed session: ${exchange.sealedSession?.length ?? 0} characters; cookie password: ${cookiePasswordLength} characters`);

      assert.ok(cookiePasswordLength >= 32, 'The cookie password is shorter than 32 characters.');
      assert.equal(token.alg, 'RS256');
      assert.equal(token.claims.iss, browserIssuer(settings));
      assert.match(String(token.claims.sid), /^session_/);
      assert.equal(token.claims.client_id, settings.clientId);
      assert.equal(token.claims.aud, undefined);
      assert.equal(token.lifetime, 300);
      assert.equal(token.claims.org_id, undefined, 'A user without a membership got an organization.');
      assert.equal(exchange.organizationId, undefined);
      assert.ok((exchange.sealedSession?.length ?? sealedSessionLimit) < sealedSessionLimit, `The sealed session is not shorter than ${sealedSessionLimit} characters.`);
      const browserKeys = createRemoteJWKSet(new URL(workos.userManagement.getJwksUrl(settings.clientId)));
      await jwtVerify(exchange.accessToken, browserKeys, { issuer: browserIssuer(settings) });
    });

    test(requiredMfa
      ? 'Given that user with an enrolled authenticator, when the user signs in again in a new browser, then AuthKit asks for the TOTP code and not for a new enrollment'
      : 'Given that Optional MFA user without an enrolled authenticator, when the user signs in again in a new browser, then the password reaches the callback without enrollment or a TOTP demand', signInOptions, async (t) => {
      const { visit } = await run.newUserLaterSignIn();
      t.diagnostic(`AuthKit pages before the callback: ${visit.pages.join(' > ')}`);

      if (requiredMfa) assert.ok(visit.pages.includes('/mfa/verification'), 'AuthKit did not ask for the TOTP code.');
      else {
        assert.ok(visit.pages.includes('/password'), 'AuthKit did not ask for the password.');
        assert.ok(visit.pages.every((path) => !path.startsWith('/mfa/')), 'Optional MFA demanded an MFA step.');
      }
      assert.ok(!visit.pages.includes('/mfa/enrollment'), 'AuthKit asked for a new MFA enrollment.');
    });

    test('Given a user with User and Admin in organization A and User in organization B, when the user signs in and chooses A, then AuthKit asks for the organization, and the access token has org_id A, the roles admin and user, and the permissions product:access and user-grants:manage', signInOptions, async (t) => {
      const { organizationA } = await run.fixtures();
      const { visit, exchange } = await run.organizationSignIn();
      const token = readToken(exchange.accessToken);
      t.diagnostic(`AuthKit pages before the callback: ${visit.pages.join(' > ')}`);
      t.diagnostic(`browser access token: ${tokenRecord(token)}`);

      assert.ok(visit.pages.includes('/organization-selection'), 'AuthKit did not ask for the organization.');
      assert.equal(exchange.organizationId, organizationA.id);
      assert.equal(token.claims.org_id, organizationA.id);
      assert.deepEqual(sortedClaimList(token, 'roles'), ['admin', 'user']);
      assert.deepEqual(sortedClaimList(token, 'permissions'), ['product:access', 'user-grants:manage']);
    });

    test('Given that session in organization A, when the server refreshes it for organization B and then for an organization without a membership, then B gives org_id B with the role user and the permission product:access in the same session, the other organization fails with organization_membership_not_found, and the session still refreshes after it', signInOptions, async (t) => {
      const { organizationB, clientOwner } = await run.fixtures();
      const { session } = await run.organizationSignIn();

      const inB = refreshedToken(await session.refresh(organizationB.id));
      t.diagnostic(`after the refresh for B: ${tokenRecord(inB)}`);
      assert.equal(inB.claims.org_id, organizationB.id);
      assert.deepEqual(sortedClaimList(inB, 'roles'), ['user']);
      assert.deepEqual(sortedClaimList(inB, 'permissions'), ['product:access']);
      assert.equal(inB.claims.sid, session.sessionId);

      const failure = await session.refresh(clientOwner.id).then(() => undefined, (error: unknown) => error);
      t.diagnostic(`refresh for an organization without a membership: ${errorCode(failure)}${failure instanceof OauthException ? ` HTTP ${failure.status} ${String(failure.error)}` : ''}`);
      assert.ok(failure instanceof OauthException, 'The refresh for an organization without a membership did not fail with an OauthException.');
      assert.equal(failure.error, 'organization_membership_not_found');

      const after = refreshedToken(await session.refresh());
      t.diagnostic(`after the failed refresh: ${tokenRecord(after)}`);
      assert.equal(after.claims.sid, session.sessionId);
    });
  });
}
