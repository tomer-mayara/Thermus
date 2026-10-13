import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LocalUserAdministration, type PasswordSource } from '../../../src/auth-better-auth/local-user-administration.ts';
import { PasswordAnswers, rejectsWith } from './fixtures/administration-fixtures.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';

describe('LocalUserAdministration client registration', () => {
  describe('register client', () => {
    test('Given an enabled account with a browser session, when an approved client is registered, then the provider creates a native public client with that account\'s new session, deletes only that session, and the browser session stays', async () => {
      const provider = new LocalProviderDouble();
      const alice = provider.addUser('alice@example.com', 'alice-password-1');
      const browserSession = provider.startSession(alice.id);

      const client = await new LocalUserAdministration(provider.auth).registerClient(
        'alice@example.com',
        new PasswordAnswers('alice-password-1').read,
        { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] },
      );

      assert.deepEqual(provider.clients, [{
        clientId: client.clientId,
        sessionUserId: alice.id,
        metadata: {
          client_name: 'Native MCP client',
          redirect_uris: [loopbackRedirectUri],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          application_type: 'native',
        },
      }]);
      assert.deepEqual(client, { clientId: provider.clients[0]?.clientId, name: 'Native MCP client', redirectUris: [loopbackRedirectUri] });
      assert.deepEqual(provider.sessionsOf(alice.id), [browserSession]);
    });

    test('Given an unknown or a disabled account, when a client is registered for it, then it fails before it asks for a password and creates no session or client', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('dana@example.com', 'dana-password-1', true);
      const administration = new LocalUserAdministration(provider.auth);
      const answers = new PasswordAnswers('carol-password-1', 'dana-password-1');
      const client = { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] };

      await assert.rejects(administration.registerClient('carol@example.com', answers.read, client), rejectsWith('unknown-account'));
      await assert.rejects(administration.registerClient('dana@example.com', answers.read, client), rejectsWith('disabled-account'));

      assert.equal(answers.asked, 0);
      assert.deepEqual([provider.sessions.size, provider.clients.length], [0, 0]);
    });

    test('Given a wrong password, when a client is registered, then it fails with incorrect-password and creates no session or client', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');

      await assert.rejects(new LocalUserAdministration(provider.auth).registerClient(
        'alice@example.com',
        new PasswordAnswers('wrong-password-1').read,
        { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] },
      ), rejectsWith('incorrect-password'));

      assert.deepEqual([provider.sessions.size, provider.clients.length], [0, 0]);
    });

    test('Given an account that the provider refuses to sign in as disabled, when a client is registered, then it fails with disabled-account', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new LocalUserAdministration(provider.auth);
      const banBeforeSignIn: PasswordSource = async () => {
        const alice = provider.userByEmail('alice@example.com');
        if (alice) alice.banned = true;
        return 'alice-password-1';
      };

      await assert.rejects(administration.registerClient('alice@example.com', banBeforeSignIn, {
        name: 'Native MCP client',
        redirectUris: [loopbackRedirectUri],
      }), rejectsWith('disabled-account'));

      assert.deepEqual([provider.sessions.size, provider.clients.length], [0, 0]);
    });

    test('Given redirect URIs outside the approved loopback form, when a client is registered, then each fails with invalid-redirect-uri and a message without the URI, before any provider call or password prompt', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new LocalUserAdministration(provider.auth);
      const answers = new PasswordAnswers();
      const refused = [
        [],
        ['https://client.example/callback'],
        ['https://127.0.0.1:33418/callback'],
        ['http://192.0.2.10:33418/callback'],
        ['http://127.1:33418/callback'],
        ['http://localhost.:33418/callback'],
        ['http://127.0.0.1:33418/callback#fragment'],
        ['http://user:secret@127.0.0.1:33418/callback'],
        ['http://127.0.0.1@client.example/callback'],
        ['http://127.0.0.1:99999/callback'],
        ['http://127.0.0.1:33418/call back'],
        ['com.example.app:/callback'],
        ['/callback'],
        [loopbackRedirectUri, 'https://client.example/callback'],
      ];

      for (const redirectUris of refused) {
        await assert.rejects(administration.registerClient('alice@example.com', answers.read, { name: 'Native MCP client', redirectUris }), (error) => {
          assert.ok(rejectsWith('invalid-redirect-uri')(error), JSON.stringify(redirectUris));
          assert.doesNotMatch((error as Error).message, /client\.example|192\.0\.2|secret|#fragment|99999/);
          return true;
        });
      }

      assert.equal(answers.asked, 0);
      assert.deepEqual(provider.calls, []);
    });

    test('Given approved loopback redirect URIs, when a client is registered, then the provider gets them exactly as written', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const redirectUris = [
        'http://127.0.0.1:33418/callback',
        'http://localhost:6274/oauth/callback?client=inspector',
        'http://[::1]:8000/',
        'http://LOCALHOST/callback',
        'http://127.0.0.1:33418',
      ];

      await new LocalUserAdministration(provider.auth).registerClient(
        'alice@example.com',
        new PasswordAnswers('alice-password-1').read,
        { name: 'Native MCP client', redirectUris },
      );

      assert.deepEqual(provider.clients[0]?.metadata.redirect_uris, redirectUris);
    });

    test('Given an empty or control-character client name, when a client is registered, then it fails with invalid-client-name before any provider call', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new LocalUserAdministration(provider.auth);

      for (const name of ['', '   ', 'Native\nclient']) {
        await assert.rejects(
          administration.registerClient('alice@example.com', new PasswordAnswers().read, { name, redirectUris: [loopbackRedirectUri] }),
          rejectsWith('invalid-client-name'),
        );
      }

      assert.deepEqual(provider.calls, []);
    });

    test('Given a provider failure while the client is created, when a client is registered, then the registration session is still deleted and the provider error reaches the caller', async () => {
      const provider = new LocalProviderDouble();
      const alice = provider.addUser('alice@example.com', 'alice-password-1');
      const failure = new Error('client storage failed');
      provider.failures.set('adminCreateOAuthClient', failure);

      await assert.rejects(new LocalUserAdministration(provider.auth).registerClient(
        'alice@example.com',
        new PasswordAnswers('alice-password-1').read,
        { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] },
      ), (error) => error === failure);

      assert.deepEqual(provider.sessionsOf(alice.id), []);
      assert.match(provider.calls.at(-1) ?? '', /^deleteSession /);
    });

    test('Given a registration session that cannot be deleted, when a client is registered, then the caller gets the cleanup error; when the creation also fails, the caller gets both errors', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new LocalUserAdministration(provider.auth);
      const cleanupFailure = new Error('session delete failed');
      const creationFailure = new Error('client storage failed');
      const register = () => administration.registerClient(
        'alice@example.com',
        new PasswordAnswers('alice-password-1').read,
        { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] },
      );
      provider.failures.set('deleteSession', cleanupFailure);

      await assert.rejects(register(), (error) => error === cleanupFailure);
      provider.failures.set('adminCreateOAuthClient', creationFailure);
      await assert.rejects(register(), (error) => {
        assert.ok(error instanceof SuppressedError);
        assert.equal(error.error, cleanupFailure);
        assert.equal(error.suppressed, creationFailure);
        return true;
      });
    });
  });
});
