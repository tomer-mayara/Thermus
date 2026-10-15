import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BetterAuthUserAdministration } from '../../../src/auth/local-auth/better-auth/better-auth-user-administration.ts';
import { LocalProviderDouble } from '../../support/doubles/auth/local-provider-double.ts';
import { PasswordAnswers, providerSnapshot, rejectsWith, twoUsersWithSessions } from './fixtures/administration-fixtures.ts';

describe('BetterAuthUserAdministration revocation', () => {
  describe('reset password', () => {
    test('Given two users with sessions, when the password of one user is reset, then only that user gets the provider hash of the new password and loses its sessions; its ID and state stay; the peer keeps its password and sessions', async () => {
      const provider = new LocalProviderDouble();
      const { alice, bob } = twoUsersWithSessions(provider);
      const answers = new PasswordAnswers('alice-password-2');

      const account = await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).resetPassword('alice@example.com', answers.read);

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

      const account = await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).resetPassword('dana@example.com', new PasswordAnswers('dana-password-2').read);

      assert.deepEqual(account, { id: dana.id, email: 'dana@example.com', disabled: true });
      assert.equal(provider.users.get(dana.id)?.banned, true);
      assert.equal(provider.credentials.get(dana.id), LocalProviderDouble.hashOf('dana-password-2'));
      assert.deepEqual(provider.sessionsOf(dana.id), []);
    });

    test('Given an unknown email, when a password is reset, then it fails with unknown-account before it asks for a password, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = providerSnapshot(provider);
      const answers = new PasswordAnswers('carol-password-1');

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).resetPassword('carol@example.com', answers.read), rejectsWith('unknown-account'));

      assert.equal(answers.asked, 0);
      assert.deepEqual(providerSnapshot(provider), before);
    });

    test('Given a new password outside the allowed length, when a password is reset, then it fails with invalid-password, and the user keeps its password and sessions', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = providerSnapshot(provider);

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).resetPassword('alice@example.com', new PasswordAnswers('short').read), rejectsWith('invalid-password'));

      assert.deepEqual(providerSnapshot(provider), before);
    });

    test('Given a user without a password login, when its password is reset, then it fails with no-password-login before it asks for a password, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      const erin = provider.addUser('erin@example.com', undefined);
      provider.startSession(erin.id);
      const before = providerSnapshot(provider);
      const answers = new PasswordAnswers('erin-password-1');

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).resetPassword('erin@example.com', answers.read), rejectsWith('no-password-login'));

      assert.equal(answers.asked, 0);
      assert.deepEqual(providerSnapshot(provider), before);
    });
  });

  describe('disable', () => {
    test('Given two users with sessions, when one user is disabled, then only that user is banned without an expiry and loses its sessions; its ID stays; the peer keeps its state and sessions', async () => {
      const provider = new LocalProviderDouble();
      const { alice, bob } = twoUsersWithSessions(provider);

      const account = await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).disableUser('bob@example.com');

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

      const account = await new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).disableUser('dana@example.com');

      assert.deepEqual(account, { id: dana.id, email: 'dana@example.com', disabled: true });
      assert.deepEqual(provider.sessionsOf(dana.id), []);
    });

    test('Given an unknown email, when a user is disabled, then it fails with unknown-account, and nothing changes', async () => {
      const provider = new LocalProviderDouble();
      twoUsersWithSessions(provider);
      const before = providerSnapshot(provider);

      await assert.rejects(new BetterAuthUserAdministration(provider.auth, provider.resourceServerClient).disableUser('carol@example.com'), rejectsWith('unknown-account'));

      assert.deepEqual(providerSnapshot(provider), before);
    });
  });
});
