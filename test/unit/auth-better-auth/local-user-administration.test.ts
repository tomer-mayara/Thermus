import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  LocalAdministrationError,
  LocalUserAdministration,
  type AdministrationFailure,
  type PasswordSource,
} from '../../../src/auth-better-auth/local-user-administration.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

const loopbackRedirectUri = 'http://127.0.0.1:33418/callback';

class PasswordAnswers {
  asked = 0;
  private readonly answers: string[];

  constructor(...answers: string[]) {
    this.answers = answers;
  }

  readonly read: PasswordSource = async () => {
    this.asked += 1;
    const answer = this.answers.shift();
    assert.ok(answer !== undefined, 'the administration asked for more passwords than the operator gave');
    return answer;
  };
}

function rejectsWith(reason: AdministrationFailure) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof LocalAdministrationError, String(error));
    assert.equal(error.reason, reason);
    return true;
  };
}

function snapshot(provider: LocalProviderDouble) {
  return structuredClone({
    users: [...provider.users.values()],
    credentials: [...provider.credentials],
    sessions: [...provider.sessions],
    clients: provider.clients,
  });
}

function twoUsersWithSessions(provider: LocalProviderDouble) {
  const alice = provider.addUser('alice@example.com', 'alice-password-1');
  const bob = provider.addUser('bob@example.com', 'bob-password-1');
  for (const user of [alice, bob]) provider.startSession(user.id);
  return { alice, bob };
}

describe('LocalUserAdministration', () => {
  describe('add', () => {
    test('Given no account with the email, when an account is added, then the provider creates it enabled, with the email in lower case and the provider hash of the hidden password', async () => {
      const provider = new LocalProviderDouble();
      const answers = new PasswordAnswers('alice-password-1');

      const account = await new LocalUserAdministration(provider.auth).addUser('Alice@Example.com', answers.read);

      const stored = provider.userByEmail('alice@example.com');
      assert.ok(stored);
      assert.deepEqual(account, { id: stored.id, email: 'alice@example.com', disabled: false });
      assert.equal(provider.credentials.get(stored.id), LocalProviderDouble.hashOf('alice-password-1'));
      assert.equal(answers.asked, 1);
    });

    test('Given an account, when an account with the same email in another letter case is added, then it fails with duplicate-email before it asks for a password, and one account stays', async () => {
      const provider = new LocalProviderDouble();
      provider.addUser('alice@example.com', 'alice-password-1');
      const answers = new PasswordAnswers('other-password-1');

      await assert.rejects(new LocalUserAdministration(provider.auth).addUser('ALICE@example.com', answers.read), rejectsWith('duplicate-email'));

      assert.equal(answers.asked, 0);
      assert.equal(provider.users.size, 1);
      assert.equal(provider.credentials.get(provider.userByEmail('alice@example.com')?.id ?? ''), LocalProviderDouble.hashOf('alice-password-1'));
    });

    test('Given passwords outside 8 to 128 characters, when an account is added, then it fails with invalid-password and a message with the limits, and creates nothing; 8 and 128 characters are accepted', async () => {
      const provider = new LocalProviderDouble();
      const administration = new LocalUserAdministration(provider.auth);

      for (const password of ['seven-7', 'x'.repeat(129), '']) {
        await assert.rejects(administration.addUser('alice@example.com', new PasswordAnswers(password).read), (error) => {
          assert.ok(rejectsWith('invalid-password')(error));
          assert.equal((error as Error).message, 'The password must have 8 to 128 characters.');
          return true;
        });
      }
      assert.deepEqual(provider.calls, []);
      await administration.addUser('ann@example.com', new PasswordAnswers('eight-88').read);
      await administration.addUser('ben@example.com', new PasswordAnswers('y'.repeat(128)).read);
      assert.equal(provider.users.size, 2);
    });

    test('Given an email that the provider refuses, when an account is added, then it fails with invalid-email and a message without the email', async () => {
      const provider = new LocalProviderDouble();

      await assert.rejects(new LocalUserAdministration(provider.auth).addUser('not-an-email', new PasswordAnswers('valid-password-1').read), (error) => {
        assert.ok(rejectsWith('invalid-email')(error));
        assert.doesNotMatch((error as Error).message, /not-an-email/);
        return true;
      });

      assert.equal(provider.users.size, 0);
    });
  });

  describe('list', () => {
    test('Given enabled and disabled accounts, when the accounts are listed, then each has only its ID, email, and disabled state, in email order', async () => {
      const provider = new LocalProviderDouble();
      const carol = provider.addUser('carol@example.com', 'carol-password-1', false);
      const alice = provider.addUser('alice@example.com', 'alice-password-1');
      const bob = provider.addUser('bob@example.com', 'bob-password-1', true);

      const accounts = await new LocalUserAdministration(provider.auth).listUsers();

      assert.deepEqual(accounts, [
        { id: alice.id, email: 'alice@example.com', disabled: false },
        { id: bob.id, email: 'bob@example.com', disabled: true },
        { id: carol.id, email: 'carol@example.com', disabled: false },
      ]);
    });

    test('Given more accounts than one provider page, when the accounts are listed, then each account is listed one time in email order', async () => {
      const provider = new LocalProviderDouble();
      const emails = Array.from({ length: 205 }, (_, index) => `user-${String(index).padStart(3, '0')}@example.com`);
      for (const email of [...emails].reverse()) provider.addUser(email, 'user-password-1');

      const accounts = await new LocalUserAdministration(provider.auth).listUsers();

      assert.deepEqual(accounts.map(({ email }) => email), emails);
      assert.deepEqual(provider.listPageSizes, [100, 100, 100]);
    });

    test('Given no account, when the accounts are listed, then the list is empty', async () => {
      const provider = new LocalProviderDouble();

      assert.deepEqual(await new LocalUserAdministration(provider.auth).listUsers(), []);
    });
  });

  describe('reset password', () => {
    test('Given two users with sessions, when the password of one user is reset, then only that user gets the provider hash of the new password and loses its sessions; its ID and state stay; the peer keeps its password and sessions', async () => {
      const provider = new LocalProviderDouble();
      const { alice, bob } = twoUsersWithSessions(provider);
      const answers = new PasswordAnswers('alice-password-2');

      const account = await new LocalUserAdministration(provider.auth).resetPassword('alice@example.com', answers.read);

      assert.deepEqual(account, { id: alice.id, email: 'alice@example.com', disabled: false });
      assert.equal(provider.credentials.get(alice.id), LocalProviderDouble.hashOf('alice-password-2'));
      assert.deepEqual(provider.sessionsOf(alice.id), []);
      assert.equal(provider.users.get(alice.id)?.banned, null);
      assert.equal(provider.credentials.get(bob.id), LocalProviderDouble.hashOf('bob-password-1'));
      assert.equal(provider.sessionsOf(bob.id).length, 1);
      assert.deepEqual(provider.calls, [`updatePassword ${alice.id}`, `deleteUserSessions ${alice.id}`]);
    });

    test('Given a disabled user with a session, when its password is reset, then the password changes, its sessions end, and it stays disabled', async () => {
      const provider = new LocalProviderDouble();
      const dana = provider.addUser('dana@example.com', 'dana-password-1', true);
      provider.startSession(dana.id);

      const account = await new LocalUserAdministration(provider.auth).resetPassword('dana@example.com', new PasswordAnswers('dana-password-2').read);

      assert.deepEqual(account, { id: dana.id, email: 'dana@example.com', disabled: true });
      assert.equal(provider.users.get(dana.id)?.banned, true);
      assert.equal(provider.credentials.get(dana.id), LocalProviderDouble.hashOf('dana-password-2'));
      assert.deepEqual(provider.sessionsOf(dana.id), []);
    });

    test('Given an unknown email, when a password is reset, then it fails with unknown-account before it asks for a password, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = snapshot(provider);
      const answers = new PasswordAnswers('carol-password-1');

      await assert.rejects(new LocalUserAdministration(provider.auth).resetPassword('carol@example.com', answers.read), rejectsWith('unknown-account'));

      assert.equal(answers.asked, 0);
      assert.deepEqual(snapshot(provider), before);
    });

    test('Given a new password outside the allowed length, when a password is reset, then it fails with invalid-password, and the user keeps its password and sessions', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = snapshot(provider);

      await assert.rejects(new LocalUserAdministration(provider.auth).resetPassword('alice@example.com', new PasswordAnswers('short').read), rejectsWith('invalid-password'));

      assert.deepEqual(snapshot(provider), before);
    });

    test('Given a user without a password login, when its password is reset, then it fails with no-password-login before it asks for a password, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      const erin = provider.addUser('erin@example.com', undefined);
      provider.startSession(erin.id);
      const before = snapshot(provider);
      const answers = new PasswordAnswers('erin-password-1');

      await assert.rejects(new LocalUserAdministration(provider.auth).resetPassword('erin@example.com', answers.read), rejectsWith('no-password-login'));

      assert.equal(answers.asked, 0);
      assert.deepEqual(snapshot(provider), before);
    });
  });

  describe('disable', () => {
    test('Given two users with sessions, when one user is disabled, then only that user is banned without an expiry and loses its sessions; its ID stays; the peer keeps its state and sessions', async () => {
      const provider = new LocalProviderDouble();
      const { alice, bob } = twoUsersWithSessions(provider);

      const account = await new LocalUserAdministration(provider.auth).disableUser('bob@example.com');

      assert.deepEqual(account, { id: bob.id, email: 'bob@example.com', disabled: true });
      assert.deepEqual({ banned: provider.users.get(bob.id)?.banned, banExpires: provider.users.get(bob.id)?.banExpires }, { banned: true, banExpires: null });
      assert.deepEqual(provider.sessionsOf(bob.id), []);
      assert.equal(provider.users.get(alice.id)?.banned, null);
      assert.equal(provider.sessionsOf(alice.id).length, 1);
      assert.deepEqual(provider.calls, [`updateUser ${bob.id} {"banned":true,"banExpires":null}`, `deleteUserSessions ${bob.id}`]);
    });

    test('Given a disabled user with a session, when it is disabled again, then it stays disabled and its sessions end', async () => {
      const provider = new LocalProviderDouble();
      const dana = provider.addUser('dana@example.com', 'dana-password-1', true);
      provider.startSession(dana.id);

      const account = await new LocalUserAdministration(provider.auth).disableUser('dana@example.com');

      assert.deepEqual(account, { id: dana.id, email: 'dana@example.com', disabled: true });
      assert.deepEqual(provider.sessionsOf(dana.id), []);
    });

    test('Given an unknown email, when a user is disabled, then it fails with unknown-account, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = snapshot(provider);

      await assert.rejects(new LocalUserAdministration(provider.auth).disableUser('carol@example.com'), rejectsWith('unknown-account'));

      assert.deepEqual(snapshot(provider), before);
    });
  });

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
