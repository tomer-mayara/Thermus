import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { errorCodeOf, followAuthorizationWithConsent, HttpAgent, loopbackRedirectUri, PreRegisteredNativeClient, ResourceServerClient, } from '../../support/better-auth-agents.js';
import { mcpResourceUrl, withRegistrationSession } from '../../support/better-auth-local.js';
import { assertExit, assertRevealsNone } from '../../support/command-process.js';
import { dataDirectory } from '../../support/data-directory.js';
import { addUser, listedAccounts, operatorOn, registerArgs, registeredClientId, resourceServerClient, signedInUserId, signIn, storedResourceServerClient, userGrant, } from '../../support/local-commands.js';
import { withRuntime } from '../../support/local-runtime.js';
const alice = { email: 'alice@example.com', password: 'alice-password-1' };
const bob = { email: 'bob@example.com', password: 'bob-password-1' };
const dana = { email: 'dana@example.com', password: 'dana-password-1' };
function pkceChallenge() {
    return createHash('sha256').update('integration-test-verifier').digest('base64url');
}
describe('Local auth command, account state, and grants with the real provider', () => {
    test('Given an installation whose only account is disabled, when add runs for a new email, then the new account can sign in and the disabled account keeps its ID and stays disabled', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        assertExit(await addUser(operator, dana), 0);
        assertExit(await operator(['users', 'disable', dana.email]), 0);
        const [disabled] = await listedAccounts(operator);
        const recovery = await addUser(operator, alice);
        assertExit(recovery, 0);
        const accounts = await listedAccounts(operator);
        assert.deepEqual(accounts.map(({ email, state }) => ({ email, state })), [
            { email: alice.email, state: 'enabled' },
            { email: dana.email, state: 'disabled' },
        ]);
        assert.equal(accounts[1]?.id, disabled?.id);
        await withRuntime(directory, async ({ auth }) => {
            assert.equal(await signedInUserId(auth, alice), accounts[0]?.id);
            assert.equal(await errorCodeOf(await signIn(auth, dana)), 'BANNED_USER');
        });
    });
    test('Given a disabled account, when reset-password and disable run for it again, then it keeps its ID, stays disabled, and only its new password reaches the disabled-account check', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        for (const account of [alice, bob])
            assertExit(await addUser(operator, account), 0);
        assertExit(await operator(['users', 'disable', bob.email]), 0);
        const before = await listedAccounts(operator);
        const reset = await operator(['users', 'reset-password', bob.email], ['bob-password-2', 'bob-password-2']);
        const disableAgain = await operator(['users', 'disable', bob.email]);
        assertExit(reset, 0);
        assert.match(reset.stdout, /The account stays disabled\./);
        assertExit(disableAgain, 0);
        assert.deepEqual(await listedAccounts(operator), before);
        assertRevealsNone([reset, disableAgain], [bob.password, 'bob-password-2']);
        await withRuntime(directory, async ({ auth }) => {
            assert.equal((await signIn(auth, bob)).status, 401);
            const withNewPassword = await signIn(auth, { email: bob.email, password: 'bob-password-2' });
            assert.equal(withNewPassword.status, 403);
            assert.equal(await errorCodeOf(withNewPassword), 'BANNED_USER');
            assert.equal(await signedInUserId(auth, alice), before[0]?.id);
        });
    });
    test('Given two users with sessions, MCP tokens, and pending authorization codes, when a client registration and then a password reset run for one user, then the registration keeps that user\'s grants, and the reset ends only that user\'s session, token, and pending code', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        for (const account of [alice, bob])
            assertExit(await addUser(operator, account), 0);
        const clientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
        const grants = await withRuntime(directory, async ({ auth }) => {
            const native = new PreRegisteredNativeClient(auth, clientId);
            const users = [await userGrant(auth, native, alice), await userGrant(auth, native, bob)];
            const pending = await Promise.all(users.map(async ({ browser }) => {
                const request = native.authorizationRequest();
                return { callback: (await followAuthorizationWithConsent(browser, request.path)).href, verifier: request.verifier };
            }));
            return { resourceServer: await resourceServerClient(auth, bob), users, pending };
        });
        const registration = await operator(registerArgs(alice, ['http://127.0.0.1:33419/callback']), [alice.password]);
        const afterRegistration = await withRuntime(directory, async ({ auth }) => {
            const introspection = new ResourceServerClient(auth, grants.resourceServer.clientId, grants.resourceServer.clientSecret);
            return {
                session: await new HttpAgent(auth, grants.users[0]?.browser.cookies).sessionId(),
                token: (await introspection.introspect(grants.users[0]?.accessToken ?? '')).active,
            };
        });
        const reset = await operator(['users', 'reset-password', alice.email], ['alice-password-2', 'alice-password-2']);
        assertExit(registration, 0);
        assertExit(reset, 0);
        assert.ok(afterRegistration.session, 'the registration kept the browser session of its account');
        assert.equal(afterRegistration.token, true);
        assertRevealsNone([registration, reset], [alice.password, 'alice-password-2']);
        await withRuntime(directory, async ({ auth }) => {
            const introspection = new ResourceServerClient(auth, grants.resourceServer.clientId, grants.resourceServer.clientSecret);
            const native = new PreRegisteredNativeClient(auth, clientId);
            const [aliceGrant, bobGrant] = grants.users;
            const [alicePending, bobPending] = grants.pending;
            assert.ok(aliceGrant && bobGrant && alicePending && bobPending);
            assert.equal(await new HttpAgent(auth, aliceGrant.browser.cookies).sessionId(), undefined);
            assert.deepEqual(await introspection.introspect(aliceGrant.accessToken), { active: false });
            const aliceExchange = await native.exchange(new URL(alicePending.callback), alicePending.verifier);
            assert.equal(aliceExchange.status, 400);
            assert.ok(await new HttpAgent(auth, bobGrant.browser.cookies).sessionId(), 'the peer keeps its session');
            assert.equal((await introspection.introspect(bobGrant.accessToken)).active, true);
            const bobExchange = await native.exchange(new URL(bobPending.callback), bobPending.verifier);
            assert.equal(bobExchange.status, 200, await bobExchange.clone().text());
        });
    });
    test('Given an enabled account, when a client registers with two exact redirect URIs, then both persist for the installation, authorization accepts another loopback port but refuses another path, and no registration session stays', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        assertExit(await addUser(operator, alice), 0);
        const redirectUris = [loopbackRedirectUri, 'http://localhost:6274/oauth/callback'];
        const clientId = registeredClientId(await operator(registerArgs(alice, redirectUris), [alice.password]));
        await withRuntime(directory, async ({ auth }) => {
            const provider = await auth.$context;
            const aliceId = (await provider.internalAdapter.findUserByEmail(alice.email))?.user.id ?? '';
            assert.deepEqual(await provider.internalAdapter.listSessions(aliceId), []);
            const clients = await withRegistrationSession(auth, alice, (headers) => auth.api.getOAuthClients({ headers }));
            assert.deepEqual(clients?.map(({ client_id, redirect_uris, token_endpoint_auth_method }) => ({ client_id, redirect_uris, token_endpoint_auth_method })), [
                { client_id: storedResourceServerClient(directory).clientId, redirect_uris: [], token_endpoint_auth_method: 'client_secret_basic' },
                { client_id: clientId, redirect_uris: redirectUris, token_endpoint_auth_method: 'none' },
            ]);
            const browser = new HttpAgent(auth);
            assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
            assert.equal((await new PreRegisteredNativeClient(auth, clientId).authorize(browser)).refresh_token, undefined);
            const redirectedTo = async (redirectUri) => {
                const query = new URLSearchParams({
                    response_type: 'code',
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scope: 'openid',
                    state: 'integration-state',
                    code_challenge: pkceChallenge(),
                    code_challenge_method: 'S256',
                    resource: mcpResourceUrl,
                });
                const response = await browser.request('GET', `/api/auth/oauth2/authorize?${query}`, { origin: null });
                return response.headers.get('Location') ?? '';
            };
            assert.match(await redirectedTo('http://127.0.0.1:44444/callback'), /^http:\/\/127\.0\.0\.1:44444\/callback\?.*code=/);
            const otherPath = await redirectedTo('http://127.0.0.1:33418/other');
            assert.ok(!otherPath.startsWith('http://127.0.0.1:33418/other'), otherPath);
            assert.match(otherPath, /invalid_redirect/);
        });
    });
});
//# sourceMappingURL=local-auth-command-grants.test.js.map