import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HttpAgent, loopbackRedirectUri, PreRegisteredNativeClient } from '../../support/better-auth-agents.ts';
import { withRegistrationSession, type AccountCredentials } from '../../support/better-auth-local.ts';
import { assertExit, assertRevealsNone } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { addUser, operatorOn, registerArgs, registeredClientId } from '../../support/local-commands.ts';
import { selfHostedSettings, withRuntime } from '../../support/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };

describe('Offline approved MCP client registration', () => {
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
      assert.deepEqual(clients?.map(({ client_id, redirect_uris }) => ({ client_id, redirect_uris })), [{ client_id: clientId, redirect_uris: [loopbackRedirectUri] }]);
      const browser = new HttpAgent(auth);
      assert.equal((await browser.signIn(alice.email, alice.password)).status, 200);
      const tokens = await new PreRegisteredNativeClient(auth, clientId).authorize(browser);
      assert.equal(tokens.refresh_token, undefined);
    });
  });
});
