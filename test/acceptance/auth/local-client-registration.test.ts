import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SERVER_INFO_META_KEY, UnauthorizedError } from '@modelcontextprotocol/client';
import { HttpAgent, loopbackRedirectUri, PreRegisteredNativeClient, ResourceServerClient } from '../../support/better-auth-agents.ts';
import { mcpResourceUrl, withRegistrationSession, type AccountCredentials } from '../../support/better-auth-local.ts';
import { assertExit, assertRevealsNone } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { addUser, operatorOn, registerArgs, registeredClientId, storedResourceServerClient } from '../../support/local-commands.ts';
import { selfHostedServerSettings, withRuntime } from '../../support/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';
import { LocalMcpUser } from '../../support/local-mcp-user.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
const resourceServerRegistered = 'Registered the resource-server client that the MCP server uses to check access tokens.';

describe('Offline approved MCP client registration', () => {
  test('Given the Thermus program, when an operator enters an unknown command, then the usage names the Thermus commands', async (t) => {
    const operator = operatorOn(t, dataDirectory(t));

    const result = await operator(['unknown']);

    assertExit(result, 2);
    assert.match(result.stderr, /thermus users add <email>/);
    assert.match(result.stderr, /thermus clients register/);
    assert.doesNotMatch(result.stderr, /magumagu/i);
  });

  test('Given a fresh Thermus installation with an approved client, when a user signs in and discovers the MCP server, then the sign-in page names Thermus and the server identity is thermus', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    assertExit(await addUser(operator, alice), 0);
    const clientId = registeredClientId(await operator(registerArgs(alice), [alice.password]));
    const server = await ServerProcess.start(t, selfHostedServerSettings(directory));
    const address = await server.started();
    const user = new LocalMcpUser(() => address, clientId, alice);

    await assert.rejects(user.connectWithSavedToken(t), UnauthorizedError);
    const signIn = await user.browser.openSignIn(user.authorizationUrl());
    const signInPage = await user.browser.navigate(signIn.url, 'same-origin');
    const { client, pages } = await user.connect(t);
    const discovery = await client.discover({ timeout: 5_000, signal: t.signal });

    assert.equal(signInPage.status, 200);
    assert.match(signInPage.body, /<title>Sign in to Thermus<\/title>/);
    assert.match(signInPage.body, /<h1>Sign in to Thermus<\/h1>/);
    assert.doesNotMatch(signInPage.body, /magumagu/i);
    assert.deepEqual(pages, ['/sign-in', '/consent']);
    assert.equal(discovery._meta?.[SERVER_INFO_META_KEY]?.name, 'thermus');
  });

  test('Given an enabled account and an approved native client with an exact loopback redirect URI, when registration runs, then the client persists in the data directory, no registration session stays, and a user can authorize with that redirect URI; invalid targets and redirect URIs give safe errors and register nothing', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    for (const account of [alice, bob]) assertExit(await addUser(operator, account), 0);
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
    const server = await ServerProcess.start(t, selfHostedServerSettings(directory));
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
