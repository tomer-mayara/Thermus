import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertRevealsNone, loopbackRedirectUri, passwords, run, AdministrationOpenerDouble, ScriptedInput } from './fixtures/local-auth-command-harness.ts';
import { LocalProviderDouble } from '../../unit/auth-better-auth/fixtures/local-provider-double.ts';

describe('runLocalAuthCommand clients', () => {
  describe('clients', () => {
    test('Given an enabled account, when clients register runs with its exact redirect URIs, then it asks for the account password one time, registers the approved native client, deletes the registration session, and prints the client ID', async () => {
      const opener = new AdministrationOpenerDouble();
      const alice = opener.provider.addUser('alice@example.com', 'alice-password-1');
      const secondRedirectUri = 'http://localhost:6274/oauth/callback';

      const result = await run([
        'clients', 'register',
        '--user', 'alice@example.com',
        '--name', 'Native MCP client',
        '--redirect-uri', loopbackRedirectUri,
        `--redirect-uri=${secondRedirectUri}`,
      ], { opener, input: new ScriptedInput('alice-password-1') });

      const [client] = opener.provider.clients;
      assert.equal(result.code, 0);
      assert.deepEqual(result.prompts, ['Password of the account: ']);
      assert.equal(result.output, `Registered the client "Native MCP client" with client ID ${client?.clientId}.\n`);
      assert.deepEqual(client?.metadata.redirect_uris, [loopbackRedirectUri, secondRedirectUri]);
      assert.equal(client?.metadata.token_endpoint_auth_method, 'none');
      assert.deepEqual(opener.provider.sessionsOf(alice.id), []);
      assertRevealsNone(result);
    });

    test('Given an installation without a resource-server client, when clients register runs, then it records the new resource-server client, prints the client ID line and then a line about the resource-server client, and does not print the client secret', async () => {
      const opener = new AdministrationOpenerDouble();
      opener.provider.addUser('alice@example.com', 'alice-password-1');
      opener.provider.resourceServerClient.stored = undefined;

      const result = await run([
        'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri,
      ], { opener, input: new ScriptedInput('alice-password-1') });

      const [resourceServer, native] = opener.provider.clients;
      assert.ok(resourceServer && native);
      assert.equal(result.code, 0);
      assert.equal(result.output, [
        `Registered the client "Native MCP client" with client ID ${native.clientId}.`,
        'Registered the resource-server client that the MCP server uses to check access tokens.',
        '',
      ].join('\n'));
      assert.deepEqual(opener.provider.resourceServerClient.recorded.map(({ clientId }) => clientId), [resourceServer.clientId]);
      assertRevealsNone(result, [...passwords, LocalProviderDouble.clientSecretOf(resourceServer.clientId)]);
    });

    test('Given a redirect URI outside the approved loopback form, when clients register runs, then it exits with status 1, asks for no password, registers nothing, and does not repeat the URI', async () => {
      const opener = new AdministrationOpenerDouble();
      opener.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run([
        'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', 'https://client.example/callback',
      ], { opener, input: new ScriptedInput('alice-password-1') });

      assert.equal(result.code, 1);
      assert.doesNotMatch(result.errors, /client\.example/);
      assert.match(result.errors, /redirect URI/);
      assert.deepEqual([result.output, result.prompts, opener.provider.clients], ['', [], []]);
    });

    test('Given a wrong password or end of input, when clients register runs, then it exits with status 1, registers nothing, and leaves no session', async () => {
      const cases = [
        { input: new ScriptedInput('wrong-password-1'), message: 'The password is not correct.' },
        { input: new ScriptedInput(undefined), message: 'No password was entered.' },
      ];

      for (const { input, message } of cases) {
        const opener = new AdministrationOpenerDouble();
        opener.provider.addUser('alice@example.com', 'alice-password-1');

        const result = await run([
          'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri,
        ], { opener, input });

        assert.equal(result.code, 1);
        assert.equal(result.errors, message);
        assert.deepEqual([opener.provider.clients.length, opener.provider.sessions.size], [0, 0]);
        assertRevealsNone(result, [...passwords, 'wrong-password-1']);
      }
    });
  });
});
