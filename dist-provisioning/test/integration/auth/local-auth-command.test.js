import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { assertExit, assertRevealsNone, runCommand } from '../../support/command-process.js';
import { dataDirectory } from '../../support/data-directory.js';
import { addUser, listedAccounts, operatorOn, registerArgs, signedInUserId, signIn } from '../../support/local-commands.js';
import { selfHostedSettings, withRuntime } from '../../support/local-runtime.js';
const alice = { email: 'alice@example.com', password: 'alice-password-1' };
const bob = { email: 'bob@example.com', password: 'bob-password-1' };
const addPrompt = /Password for the new account/;
const providerTable = /"(?:user|session|account|verification|jwks|oauth[A-Za-z]+)"/;
function tracedStatements(file) {
    return readFileSync(file, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
}
describe('Local auth command line through the entry point with the real provider', () => {
    test('Given enabled and disabled accounts, when add runs for their emails in another letter case, then it fails before it asks for a password, and each account keeps its ID, state, and password', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        for (const account of [alice, bob])
            assertExit(await addUser(operator, account), 0);
        assertExit(await operator(['users', 'disable', bob.email]), 0);
        const before = await listedAccounts(operator);
        const duplicates = [
            await operator(['users', 'add', 'ALICE@EXAMPLE.COM'], ['other-password-1', 'other-password-1']),
            await operator(['users', 'add', 'Bob@Example.com'], ['other-password-1', 'other-password-1']),
        ];
        for (const result of duplicates) {
            assertExit(result, 1);
            assert.match(result.stderr, /An account with this email address already exists\./);
            assert.doesNotMatch(result.stderr, addPrompt);
        }
        assertRevealsNone(duplicates, ['other-password-1']);
        assert.deepEqual(await listedAccounts(operator), before);
        await withRuntime(directory, async ({ auth }) => {
            assert.equal(await signedInUserId(auth, alice), before[0]?.id);
            assert.equal((await signIn(auth, { email: alice.email, password: 'other-password-1' })).status, 401);
        });
    });
    test('Given an invalid email, a password outside the length rule, passwords that differ, or input that ends, when add runs, then it exits with status 1 and a safe message and adds no account', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        const cases = [
            { args: ['users', 'add', 'not-an-email'], input: ['valid-password-1', 'valid-password-1'], message: /The email address is not valid\./ },
            { args: ['users', 'add', alice.email], input: ['short-7', 'short-7'], message: /The password must have 8 to 128 characters\./ },
            { args: ['users', 'add', alice.email], input: ['x'.repeat(129), 'x'.repeat(129)], message: /The password must have 8 to 128 characters\./ },
            { args: ['users', 'add', alice.email], input: [alice.password, 'alice-password-9'], message: /The passwords do not match\./ },
            { args: ['users', 'add', alice.email], input: [], message: /No password was entered\./ },
        ];
        const results = [];
        for (const { args, input, message } of cases) {
            const result = await operator(args, input);
            results.push(result);
            assertExit(result, 1);
            assert.match(result.stderr, message);
            assert.equal(result.stdout, '');
        }
        assertRevealsNone(results, ['valid-password-1', 'short-7', 'x'.repeat(129), alice.password, 'alice-password-9']);
        assert.deepEqual(await listedAccounts(operator), []);
    });
    test('Given a password or an option among the arguments, when a command runs, then it exits with status 2 without the password in its output and creates no data', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        const results = [
            await operator(['users', 'add', alice.email, alice.password]),
            await operator(['users', 'add', `--password=${alice.password}`, alice.email]),
            await operator(['users', 'reset-password', alice.email, alice.password]),
            await operator([...registerArgs(alice), '--password', alice.password]),
        ];
        for (const result of results) {
            assertExit(result, 2);
            assert.match(result.stderr, /Usage:/);
        }
        assertRevealsNone(results, [alice.password]);
        assert.deepEqual(readdirSync(directory), []);
    });
    test('Given accounts, when a user command has no target, two targets, or an unknown email, then it fails with a usage error or an unknown-account error, asks for no password, and changes no account', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        const operator = operatorOn(t, directory);
        assertExit(await addUser(operator, alice), 0);
        const before = await listedAccounts(operator);
        const usage = [
            await operator(['users', 'reset-password']),
            await operator(['users', 'disable']),
            await operator(['users', 'disable', alice.email, bob.email]),
        ];
        const unknown = [
            await operator(['users', 'disable', 'carol@example.com']),
            await operator(['users', 'reset-password', 'carol@example.com'], ['carol-password-1', 'carol-password-1']),
            await operator(registerArgs({ email: 'carol@example.com', password: 'carol-password-1' }), ['carol-password-1']),
        ];
        for (const result of usage)
            assertExit(result, 2);
        for (const result of unknown) {
            assertExit(result, 1);
            assert.match(result.stderr, /No local account has this email address\./);
            assert.doesNotMatch(result.stderr, /carol@example\.com|[Pp]assword:/);
        }
        assertRevealsNone([...usage, ...unknown], ['carol-password-1']);
        assert.deepEqual(await listedAccounts(operator), before);
        await withRuntime(directory, async ({ auth }) => assert.equal(await signedInUserId(auth, alice), before[0]?.id));
    });
    test('Given an initialized installation, when each command runs, then each SQL statement on a provider table comes from the provider database adapter and no statement comes from the command modules', { timeout: 120_000 }, async (t) => {
        const directory = dataDirectory(t);
        await withRuntime(directory, async () => undefined);
        const traceFile = join(dataDirectory(t), 'sql-trace.jsonl');
        const settings = { ...selfHostedSettings(directory), MAGUMAGU_TEST_SQL_TRACE: traceFile };
        const traced = (args, input = []) => runCommand(t, settings, { args, input });
        const results = [
            await traced(['users', 'add', alice.email], [alice.password, alice.password]),
            await traced(['users', 'add', bob.email], [bob.password, bob.password]),
            await traced(['users', 'list']),
            await traced(['users', 'reset-password', alice.email], ['alice-password-2', 'alice-password-2']),
            await traced(['users', 'disable', bob.email]),
            await traced(registerArgs({ email: alice.email, password: 'alice-password-2' }), ['alice-password-2']),
        ];
        for (const result of results)
            assertExit(result, 0);
        const statements = tracedStatements(traceFile);
        const onProviderTables = statements.filter(({ sql }) => providerTable.test(sql));
        assert.ok(onProviderTables.length > 0, 'the trace recorded provider statements');
        for (const { sql, frame } of onProviderTables)
            assert.match(frame, /node_modules/, `${frame}: ${sql}`);
        assert.deepEqual(statements.filter(({ frame }) => /local-(?:user-administration|auth-command)/.test(frame)), []);
        assert.ok(statements.every(({ sql }) => !sql.includes(alice.password) && !sql.includes('alice-password-2')), 'no password is part of SQL text');
    });
});
//# sourceMappingURL=local-auth-command.test.js.map