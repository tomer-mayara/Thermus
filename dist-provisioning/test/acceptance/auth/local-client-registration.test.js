import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HttpAgent, loopbackRedirectUri, PreRegisteredNativeClient, ResourceServerClient } from '../../support/better-auth-agents.js';
import { mcpResourceUrl, withRegistrationSession } from '../../support/better-auth-local.js';
import { assertExit, assertRevealsNone } from '../../support/command-process.js';
import { dataDirectory } from '../../support/data-directory.js';
import { addUser, operatorOn, registerArgs, registeredClientId, storedResourceServerClient } from '../../support/local-commands.js';
import { selfHostedSettings, withRuntime } from '../../support/local-runtime.js';
import { ServerProcess } from '../../support/server-process.js';
const alice = { email: 'alice@example.com', password: 'alice-password-1' };
const bob = { email: 'bob@example.com', password: 'bob-password-1' };
const resourceServerRegistered = 'Registered the resource-server client that the MCP server uses to check access tokens.';
describe('Offline approved MCP client registration', () => {
    test('Given an enabled account and an approved native client with an exact loopback redirect URI, when registration runs, then the client persists in the data directory, no registration session stays, and a user can authorize with that redirect URI; invalid targets and redirect URIs give safe errors and register nothing', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        for (const account of [alice, bob])
            assertExit(await addUser(operator, account), 0);
        assertExit(await operator(['users', 'disable', bob.email]), 0);
        const refused = [
            await operator(registerArgs({ email: 'carol@example.com', password: 'carol-password-1' }), ['carol-password-1']),
            await operator(registerArgs(bob), [bob.password]),
            await operator(registerArgs({ email: alice.email, password: 'wrong-password-1' }), ['wrong-password-1']),
            await operator(registerArgs(alice, ['https://client.example/callback']), [alice.password]),
            await operator(registerArgs(alice, [`${loopbackRedirectUri}#fragment`]), [alice.password]),
            await operator(registerArgs(alice, ['http://user:secret@127.0.0.1:33418/callback']), [alice.password]),
        ];
        const registration = await operator(registerArgs(alice), [alice.password]);
        const clientId = registeredClientId(registration);
        const server = await ServerProcess.start(t, selfHostedSettings(directory));
        await server.stop();
        for (const result of refused) {
            assertExit(result, 1);
            assert.equal(result.stdout, '');
            assert.doesNotMatch(result.stderr, /client\.example|#fragment|user:secret/);
        }
        assertRevealsNone([...refused, registration], [alice.password, bob.password, 'carol-password-1', 'wrong-password-1']);
        await withRuntime(directory, async ({ auth }) => {
            const provider = await auth.$context;
            const aliceId = (await provider.internalAdapter.findUserByEmail(alice.email))?.user.id;
            assert.ok(aliceId);
            assert.deepEqual(await provider.internalAdapter.listSessions(aliceId), [], 'no registration session stays');
            const clients = await withRegistrationSession(auth, alice, (headers) => auth.api.getOAuthClients({ headers }));
            assert.deepEqual(clients?.map(({ client_id, redirect_uris }) => ({ client_id, redirect_uris })), [
                { client_id: storedResourceServerClient(directory).clientId, redirect_uris: [] },
                { client_id: clientId, redirect_uris: [loopbackRedirectUri] },
            ]);
            const browser = new HttpAgent(auth);
            assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
            const tokens = await new PreRegisteredNativeClient(auth, clientId).authorize(browser);
            assert.equal(tokens.refresh_token, undefined);
        });
    });
    test('Given an installation without a resource-server client, when the operator registers two native clients, then only the first registration also registers the resource-server client, the data directory keeps its credentials for the MCP resource in an owner-only file, they can introspect a user token, and no output shows the client secret', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        assertExit(await addUser(operator, alice), 0);
        const first = await operator(registerArgs(alice), [alice.password]);
        const stored = storedResourceServerClient(directory);
        const second = await operator(registerArgs(alice, ['http://127.0.0.1:33419/callback']), [alice.password]);
        const [firstClientId, secondClientId] = [registeredClientId(first), registeredClientId(second)];
        assert.equal(first.stdout, `Registered the client "Native MCP client" with client ID ${firstClientId}.\n${resourceServerRegistered}\n`);
        assert.equal(second.stdout, `Registered the client "Native MCP client" with client ID ${secondClientId}.\n`);
        assert.equal(stored.resource, mcpResourceUrl);
        assert.deepEqual(storedResourceServerClient(directory), stored);
        assertRevealsNone([first, second], [alice.password, stored.clientSecret]);
        await withRuntime(directory, async ({ auth }) => {
            const clients = await withRegistrationSession(auth, alice, (headers) => auth.api.getOAuthClients({ headers }));
            assert.deepEqual(clients?.map(({ client_id, token_endpoint_auth_method }) => ({ client_id, token_endpoint_auth_method })), [
                { client_id: stored.clientId, token_endpoint_auth_method: 'client_secret_basic' },
                { client_id: firstClientId, token_endpoint_auth_method: 'none' },
                { client_id: secondClientId, token_endpoint_auth_method: 'none' },
            ]);
            const browser = new HttpAgent(auth);
            assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
            const tokens = await new PreRegisteredNativeClient(auth, firstClientId).authorize(browser);
            const introspection = new ResourceServerClient(auth, stored.clientId, stored.clientSecret);
            assert.equal((await introspection.introspect(tokens.access_token)).active, true);
        });
    });
});
//# sourceMappingURL=local-client-registration.test.js.map