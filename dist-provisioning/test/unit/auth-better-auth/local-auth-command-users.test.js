import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertRevealsNone, passwords, run, RuntimeDouble, ScriptedInput } from './fixtures/local-auth-command-harness.js';
import { LocalProviderDouble } from './fixtures/local-provider-double.js';
describe('runLocalAuthCommand users', () => {
    describe('users', () => {
        test('Given a new email, when users add runs, then it asks for the password two times with hidden prompts, adds the account, and prints its email and ID without the password', async () => {
            const runtime = new RuntimeDouble();
            const input = new ScriptedInput('alice-password-1', 'alice-password-1');
            const result = await run(['users', 'add', 'Alice@Example.com'], { runtime, input });
            const alice = runtime.provider.userByEmail('alice@example.com');
            assert.equal(result.code, 0);
            assert.deepEqual(result.prompts, ['Password for the new account: ', 'Repeat the password: ']);
            assert.equal(result.output, `Added alice@example.com with ID ${alice?.id}.\n`);
            assert.equal(runtime.provider.credentials.get(alice?.id ?? ''), LocalProviderDouble.hashOf('alice-password-1'));
            assertRevealsNone(result);
        });
        test('Given passwords that do not match or input that ends, when users add runs, then it exits with status 1, adds no account, and reveals no password', async () => {
            const cases = [
                { input: new ScriptedInput('alice-password-1', 'alice-password-2'), message: 'The passwords do not match.' },
                { input: new ScriptedInput(undefined), message: 'No password was entered.' },
                { input: new ScriptedInput('alice-password-1', undefined), message: 'No password was entered.' },
            ];
            for (const { input, message } of cases) {
                const runtime = new RuntimeDouble();
                const result = await run(['users', 'add', 'alice@example.com'], { runtime, input });
                assert.equal(result.code, 1);
                assert.equal(result.errors, message);
                assert.equal(runtime.provider.users.size, 0);
                assertRevealsNone(result);
            }
        });
        test('Given an existing email, when users add runs for it, then it exits with status 1 before it asks for a password', async () => {
            const runtime = new RuntimeDouble();
            runtime.provider.addUser('alice@example.com', 'alice-password-1');
            const result = await run(['users', 'add', 'ALICE@example.com'], { runtime, input: new ScriptedInput('alice-password-2', 'alice-password-2') });
            assert.equal(result.code, 1);
            assert.equal(result.errors, 'An account with this email address already exists.');
            assert.deepEqual([result.output, result.prompts], ['', []]);
        });
        test('Given enabled and disabled accounts, when users list runs, then it prints a table of email, state, and ID without credentials and asks for no password', async () => {
            const runtime = new RuntimeDouble();
            const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1', true);
            const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
            const result = await run(['users', 'list'], { runtime });
            assert.equal(result.code, 0);
            assert.equal(result.output, [
                `EMAIL              STATE     ID`,
                `alice@example.com  enabled   ${alice.id}`,
                `bob@example.com    disabled  ${bob.id}`,
                '',
            ].join('\n'));
            assert.deepEqual(result.prompts, []);
            assertRevealsNone(result, [...passwords, 'provider-hash']);
        });
        test('Given no account, when users list runs, then it says how to add the first account', async () => {
            const result = await run(['users', 'list']);
            assert.equal(result.code, 0);
            assert.equal(result.output, 'No local accounts. Add one with: magumagu users add <email>\n');
        });
        test('Given two users with sessions, when users reset-password targets one, then it asks for the new password two times, ends only that user\'s sessions, keeps its ID and state, and reveals no password', async () => {
            const runtime = new RuntimeDouble();
            const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
            const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1');
            for (const user of [alice, bob])
                runtime.provider.startSession(user.id);
            const result = await run(['users', 'reset-password', 'alice@example.com'], { runtime, input: new ScriptedInput('alice-password-2', 'alice-password-2') });
            assert.equal(result.code, 0);
            assert.deepEqual(result.prompts, ['New password: ', 'Repeat the new password: ']);
            assert.equal(result.output, 'Reset the password of alice@example.com and ended its sessions.\n');
            assert.equal(runtime.provider.credentials.get(alice.id), LocalProviderDouble.hashOf('alice-password-2'));
            assert.deepEqual([runtime.provider.sessionsOf(alice.id).length, runtime.provider.sessionsOf(bob.id).length], [0, 1]);
            assert.deepEqual([...runtime.provider.users.values()].map(({ id, banned }) => ({ id, banned })), [{ id: alice.id, banned: null }, { id: bob.id, banned: null }]);
            assertRevealsNone(result);
        });
        test('Given a disabled user, when users reset-password targets it, then it says that the account stays disabled', async () => {
            const runtime = new RuntimeDouble();
            const dana = runtime.provider.addUser('dana@example.com', 'dana-password-1', true);
            const result = await run(['users', 'reset-password', 'dana@example.com'], { runtime, input: new ScriptedInput('dana-password-2', 'dana-password-2') });
            assert.equal(result.code, 0);
            assert.equal(result.output, 'Reset the password of dana@example.com and ended its sessions. The account stays disabled.\n');
            assert.equal(runtime.provider.users.get(dana.id)?.banned, true);
        });
        test('Given two users with sessions, when users disable targets one, then only that user is disabled and loses its sessions, without a password prompt', async () => {
            const runtime = new RuntimeDouble();
            const alice = runtime.provider.addUser('alice@example.com', 'alice-password-1');
            const bob = runtime.provider.addUser('bob@example.com', 'bob-password-1');
            for (const user of [alice, bob])
                runtime.provider.startSession(user.id);
            const result = await run(['users', 'disable', 'bob@example.com'], { runtime });
            assert.equal(result.code, 0);
            assert.equal(result.output, 'Disabled bob@example.com and ended its sessions.\n');
            assert.deepEqual(result.prompts, []);
            assert.deepEqual([runtime.provider.users.get(alice.id)?.banned, runtime.provider.users.get(bob.id)?.banned], [null, true]);
            assert.deepEqual([runtime.provider.sessionsOf(alice.id).length, runtime.provider.sessionsOf(bob.id).length], [1, 0]);
        });
        test('Given an unknown email, when users reset-password or users disable targets it, then it exits with status 1, asks for no password, and does not repeat the email', async () => {
            for (const action of ['reset-password', 'disable']) {
                const runtime = new RuntimeDouble();
                runtime.provider.addUser('alice@example.com', 'alice-password-1');
                const result = await run(['users', action, 'carol@example.com'], { runtime, input: new ScriptedInput('carol-password-1', 'carol-password-1') });
                assert.equal(result.code, 1);
                assert.equal(result.errors, 'No local account has this email address.');
                assert.deepEqual([result.output, result.prompts], ['', []]);
            }
        });
    });
});
//# sourceMappingURL=local-auth-command-users.test.js.map