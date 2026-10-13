import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertRevealsNone, loopbackRedirectUri, passwords, run, RuntimeDouble, ScriptedInput } from './fixtures/local-auth-command-harness.ts';

describe('runLocalAuthCommand clients', () => {
  describe('clients', () => {
    test('Given an enabled account, when clients register runs with its exact redirect URIs, then it asks for the account password one time, registers the approved native client, deletes the registration session, and prints the client ID', async () => {
      const runtime = new RuntimeDouble();
      const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
      const secondRedirectUri = 'http://localhost:6274/oauth/callback';

      const result = await run([
        'clients', 'register',
        '--user', 'alice@example.com',
        '--name', 'Native MCP client',
        '--redirect-uri', loopbackRedirectUri,
        `--redirect-uri=${secondRedirectUri}`,
      ], { runtime, input: new ScriptedInput('alice-password-1') });

      const [client] = runtime.provider.clients;
      assert.equal(result.code, 0);
      assert.deepEqual(result.prompts, ['Password of the account: ']);
      assert.equal(result.output, `Registered the client "Native MCP client" with client ID ${client?.clientId}.\n`);
      assert.deepEqual(client?.metadata.redirect_uris, [loopbackRedirectUri, secondRedirectUri]);
      assert.equal(client?.metadata.token_endpoint_auth_method, 'none');
      assert.deepEqual(runtime.provider.sessionsOf(alice.id), []);
      assertRevealsNone(result);
    });

    test('Given a redirect URI outside the approved loopback form, when clients register runs, then it exits with status 1, asks for no password, registers nothing, and does not repeat the URI', async () => {
      const runtime = new RuntimeDouble();
      runtime.provider.addUser('alice@example.com', 'alice-password-1');

      const result = await run([
        'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', 'https://client.example/callback',
      ], { runtime, input: new ScriptedInput('alice-password-1') });

      assert.equal(result.code, 1);
      assert.doesNotMatch(result.errors, /client\.example/);
      assert.match(result.errors, /redirect URI/);
      assert.deepEqual([result.output, result.prompts, runtime.provider.clients], ['', [], []]);
    });

    test('Given a wrong password or end of input, when clients register runs, then it exits with status 1, registers nothing, and leaves no session', async () => {
      const cases = [
        { input: new ScriptedInput('wrong-password-1'), message: 'The password is not correct.' },
        { input: new ScriptedInput(undefined), message: 'No password was entered.' },
      ];

      for (const { input, message } of cases) {
        const runtime = new RuntimeDouble();
        runtime.provider.addUser('alice@example.com', 'alice-password-1');

        const result = await run([
          'clients', 'register', '--user', 'alice@example.com', '--name', 'Native MCP client', '--redirect-uri', loopbackRedirectUri,
        ], { runtime, input });

        assert.equal(result.code, 1);
        assert.equal(result.errors, message);
        assert.deepEqual([runtime.provider.clients.length, runtime.provider.sessions.size], [0, 0]);
        assertRevealsNone(result, [...passwords, 'wrong-password-1']);
      }
    });
  });
});
