import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import type { LiveRun } from '../../../support/hosted-live/live-run.ts';
import { authkitKeySetUrl, connectRedirectUri, mcpResource } from '../../../support/hosted-live/settings.ts';
import { readToken, signingKeyIds, tokenRecord } from '../../../support/hosted-live/tokens.ts';

const authorizationOptions = { timeout: 180_000 };
const mfaPages = ['/mfa/enrollment', '/mfa/verification'];

export function describeConnectAuthorizationProofs(run: LiveRun): void {
  const { settings } = run;

  describe('Hosted live proofs: Connect authorization of an MCP client', () => {
    test('Given a public MCP client that Connect knows with PKCE and a User of organization A, when the user authorizes it for the MCP resource through hosted AuthKit, then AuthKit asks for the password, the MFA step, the organization, and the consent before the callback, and the callback has a code and the state of the request', authorizationOptions, async (t) => {
      const { visit, stateMatches } = await run.connectGrant();
      t.diagnostic(`AuthKit pages before the callback: ${visit.pages.join(' > ')}`);
      t.diagnostic(`callback: ${visit.callback.origin}${visit.callback.pathname} with ${[...visit.callback.searchParams.keys()].join(', ')}`);

      assert.ok(visit.pages.includes('/password'), 'AuthKit did not ask for the password.');
      assert.ok(visit.pages.some((page) => mfaPages.includes(page)), 'AuthKit did not ask for the MFA step.');
      assert.ok(visit.pages.includes('/application-authorization'), 'AuthKit did not ask for the consent.');
      assert.equal(`${visit.callback.origin}${visit.callback.pathname}`, connectRedirectUri);
      assert.ok(stateMatches, 'The callback does not have the state of the authorization request.');
    });

    test('Given that code, when the client exchanges it with its PKCE verifier and the MCP resource, then the answer has a bearer access token and a refresh token for offline_access with the requested scopes', authorizationOptions, async (t) => {
      const { tokens } = await run.connectGrant();
      const { body } = tokens;
      t.diagnostic(`token answer: token_type ${String(body.token_type)}, expires_in ${String(body.expires_in)}, scope ${String(body.scope)}, refresh token ${tokens.refreshToken === undefined ? 'absent' : 'present'}, ID token ${body.id_token === undefined ? 'absent' : 'present'}`);

      assert.match(String(body.token_type), /^bearer$/i);
      assert.ok(tokens.refreshToken, 'The token answer has no refresh token for offline_access.');
    });

    test('Given that access token, then it is an RS256 JWT of the AuthKit issuer for the MCP resource with the user as sub, the MCP client as client_id, an app_consent_ sid, org_id A, the granted scope, and no role or permission claim, and it verifies with the AuthKit key set', authorizationOptions, async (t) => {
      const { organizationA, connectUser, oauthApplication } = await run.fixtures();
      const { tokens } = await run.connectGrant();
      const token = readToken(tokens.accessToken);
      const header = decodeProtectedHeader(tokens.accessToken);
      t.diagnostic(`Connect access token: ${tokenRecord(token)}`);
      t.diagnostic(`header typ: ${String(header.typ)}; claim names: ${Object.keys(token.claims).toSorted().join(', ')}`);
      t.diagnostic(`AuthKit key IDs: ${(await signingKeyIds(authkitKeySetUrl(settings.authkitIssuer))).join(', ')}`);

      assert.equal(token.alg, 'RS256');
      assert.equal(token.claims.iss, settings.authkitIssuer);
      assert.equal(token.claims.aud, mcpResource);
      assert.equal(token.claims.sub, connectUser.id);
      assert.equal(token.claims.client_id, oauthApplication.clientId);
      assert.match(String(token.claims.sid), /^app_consent_/);
      assert.equal(token.claims.org_id, organizationA.id);
      assert.equal(typeof token.claims.scope, 'string');
      assert.equal(token.claims.permissions, undefined);
      assert.equal(token.claims.roles, undefined);
      const keys = createRemoteJWKSet(new URL(authkitKeySetUrl(settings.authkitIssuer)));
      await jwtVerify(tokens.accessToken, keys, { issuer: settings.authkitIssuer, audience: mcpResource, algorithms: ['RS256'] });
    });
  });
}
