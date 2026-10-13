import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BetterAuthUserAdministration } from '../../../src/auth/local-auth/better-auth/better-auth-user-administration.ts';
import type { PasswordSource } from '../../../src/auth/local-auth/local-user-administration.ts';
import { PasswordAnswers, rejectsWith } from './fixtures/administration-fixtures.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';

function aliceOnInstallationWithoutResourceServerClient() {
  const provider = new LocalProviderDouble();
  const alice = provider.addUser('alice@example.com', 'alice-password-1');
  provider.resourceServerClient.stored = undefined;
  return { provider, alice, administration: new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient) };
}

function registerForAlice(administration: BetterAuthUserAdministration, redirectUri = loopbackRedirectUri) {
  return administration.registerClient('alice@example.com', new PasswordAnswers('alice-password-1').read, {
    name: 'Native MCP client',
    redirectUris: [redirectUri],
  });
}

function authMethodsOf(provider: LocalProviderDouble): unknown[] {
  return provider.clients.map(({ metadata }) => metadata.token_endpoint_auth_method);
}

function operationsOf(provider: LocalProviderDouble): string[] {
  return provider.calls.map((call) => call.split(' ')[0] ?? '');
}

describe('BetterAuthUserAdministration client registration', () => {
  describe('register client', () => {
    test('Given an enabled account with a browser session, when an approved client is registered, then the provider creates a native public client with that account\'s new session, deletes only that session, and the browser session stays', async () => {
      const provider = new LocalProviderDouble();
      const alice = provider.addUser('alice@example.com', 'alice-password-1');
      const browserSession = provider.startSession(alice.id);

      const client = await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).registerClient(
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
      assert.deepEqual(client, {
        clientId: provider.clients[0]?.clientId,
        name: 'Native MCP client',
        redirectUris: [loopbackRedirectUri],
        resourceServerClientRegistered: false,
      });
      assert.deepEqual(provider.sessionsOf(alice.id), [browserSession]);
    });

    test('Given an unknown or a disabled account, when a client is registered for it, then it fails before it asks for a password and creates no session or client', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('dana@example.com', 'dana-password-1', true);
      const administration = new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient);
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

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).registerClient(
        'alice@example.com',
        new PasswordAnswers('wrong-password-1').read,
        { name: 'Native MCP client', redirectUris: [loopbackRedirectUri] },
      ), rejectsWith('incorrect-password'));

      assert.deepEqual([provider.sessions.size, provider.clients.length], [0, 0]);
    });

    test('Given an account that the provider refuses to sign in as disabled, when a client is registered, then it fails with disabled-account', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient);
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
      const administration = new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient);
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

      await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).registerClient(
        'alice@example.com',
        new PasswordAnswers('alice-password-1').read,
        { name: 'Native MCP client', redirectUris },
      );

      assert.deepEqual(provider.clients[0]?.metadata.redirect_uris, redirectUris);
    });

    test('Given an empty or control-character client name, when a client is registered, then it fails with invalid-client-name before any provider call', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const administration = new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient);

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

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).registerClient(
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
      const administration = new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient);
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

  describe('resource-server client', () => {
    test('Given an installation without a resource-server client, when a client is registered, then the registration session first creates the confidential resource-server client and the record gets its ID and secret, then the session creates the native client and is deleted', async () => {
      const { provider, alice, administration } = aliceOnInstallationWithoutResourceServerClient();

      const client = await registerForAlice(administration);

      const [resourceServer, native] = provider.clients;
      assert.ok(resourceServer && native);
      assert.deepEqual(resourceServer, {
        clientId: resourceServer.clientId,
        sessionUserId: alice.id,
        metadata: { client_name: 'Magumagu MCP resource server', token_endpoint_auth_method: 'client_secret_basic', grant_types: ['client_credentials'] },
      });
      assert.deepEqual(provider.resourceServerClient.recorded, [
        { clientId: resourceServer.clientId, clientSecret: LocalProviderDouble.clientSecretOf(resourceServer.clientId) },
      ]);
      assert.deepEqual(authMethodsOf(provider), ['client_secret_basic', 'none']);
      assert.deepEqual(client, { clientId: native.clientId, name: 'Native MCP client', redirectUris: [loopbackRedirectUri], resourceServerClientRegistered: true });
      assert.deepEqual(operationsOf(provider), ['signInEmail', 'adminCreateOAuthClient', 'adminCreateOAuthClient', 'deleteSession']);
      assert.deepEqual(provider.sessionsOf(alice.id), []);
    });

    test('Given an installation without a resource-server client, when two clients are registered, then only the first registration creates and records a resource-server client, and the second creates only its native client', async () => {
      const { provider, administration } = aliceOnInstallationWithoutResourceServerClient();

      const first = await registerForAlice(administration);
      const second = await registerForAlice(administration, 'http://127.0.0.1:33419/callback');

      assert.deepEqual([first.resourceServerClientRegistered, second.resourceServerClientRegistered], [true, false]);
      assert.deepEqual(authMethodsOf(provider), ['client_secret_basic', 'none', 'none']);
      assert.equal(provider.resourceServerClient.recorded.length, 1);
      assert.deepEqual(provider.resourceServerClient.current(), provider.resourceServerClient.recorded[0]);
    });

    test('Given an installation without a resource-server client and a provider failure while that client is created, when a client is registered, then the registration session is deleted, the provider error reaches the caller, nothing is recorded, and no native client is created', async () => {
      const { provider, alice, administration } = aliceOnInstallationWithoutResourceServerClient();
      const failure = new Error('client storage failed');
      provider.failures.set('adminCreateOAuthClient', failure);

      await assert.rejects(registerForAlice(administration), (error) => error === failure);

      assert.deepEqual(operationsOf(provider), ['signInEmail', 'adminCreateOAuthClient', 'deleteSession']);
      assert.deepEqual([provider.clients, provider.resourceServerClient.recorded, provider.sessionsOf(alice.id)], [[], [], []]);
    });

    test('Given a provider that gives no secret for the resource-server client, when a client is registered, then it fails, records nothing, creates no native client, and deletes the registration session', async () => {
      const { provider, alice, administration } = aliceOnInstallationWithoutResourceServerClient();
      provider.withholdClientSecrets = true;

      await assert.rejects(registerForAlice(administration), { message: 'The provider gave no secret for the resource-server client.' });

      assert.deepEqual(authMethodsOf(provider), ['client_secret_basic']);
      assert.deepEqual([provider.resourceServerClient.recorded, provider.sessionsOf(alice.id)], [[], []]);
    });

    test('Given a resource-server client record that fails to read or to store, when a client is registered, then the record error reaches the caller, no native client is created, and the registration session is deleted', async () => {
      for (const failing of ['readFailure', 'recordFailure'] as const) {
        const { provider, alice, administration } = aliceOnInstallationWithoutResourceServerClient();
        const failure = new Error('The record failed.');
        provider.resourceServerClient[failing] = failure;

        await assert.rejects(registerForAlice(administration), (error) => error === failure);

        assert.ok(!authMethodsOf(provider).includes('none'), `${failing}: a native client was created`);
        assert.deepEqual([provider.resourceServerClient.recorded, provider.sessionsOf(alice.id)], [[], []], failing);
      }
    });
  });
});
