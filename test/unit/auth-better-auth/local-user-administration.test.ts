import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LocalUserAdministration } from '../../../src/auth-better-auth/local-user-administration.ts';
import { PasswordAnswers, rejectsWith } from './fixtures/administration-fixtures.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

describe('LocalUserAdministration accounts', () => {
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
});
