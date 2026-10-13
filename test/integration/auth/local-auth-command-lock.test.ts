import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { AccountCredentials } from '../../support/better-auth-local.ts';
import { assertExit, assertRevealsNone, CommandProcess } from '../../support/command-process.ts';
import { dataDirectory, storedInstallationIds } from '../../support/data-directory.ts';
import { listedAccounts, operatorOn } from '../../support/local-commands.ts';
import { selfHostedSettings } from '../../support/local-runtime.ts';
import { ServerProcess } from '../../support/server-process.ts';

const alice: AccountCredentials = { email: 'alice@example.com', password: 'alice-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
const lockError = /in use by another Magumagu process/;
const addPrompt = /Password for the new account/;

describe('Local auth command and the data-directory lock', () => {
  test('Given a fresh data directory, when two commands start at the same time, then one initializes the installation and keeps the lock while it waits for its password, and the other fails with the lock error and adds nothing', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const settings = selfHostedSettings(directory);

    const commands = [alice, bob].map((account) => CommandProcess.launch(t, settings, ['users', 'add', account.email]));
    const firstExit = await Promise.race(commands.map(async (command, index) => (await command.result(), index)));
    const refused = await commands[firstExit]?.result();
    const waiting = commands[1 - firstExit];
    assert.ok(refused && waiting);
    assert.ok(await waiting.stderrMatches(addPrompt), waiting.stderr);
    const account = firstExit === 0 ? bob : alice;
    waiting.answer([account.password, account.password]);
    const added = await waiting.result();

    assertExit(refused, 1);
    assert.match(refused.stderr, lockError);
    assert.doesNotMatch(refused.stderr, addPrompt);
    assertExit(added, 0);
    assert.equal(storedInstallationIds(directory).length, 1);
    assert.deepEqual((await listedAccounts(operatorOn(t, directory))).map(({ email }) => email), [account.email]);
    assertRevealsNone([refused, added], [alice.password, bob.password]);
  });

  test('Given a command that waits for a password, when the server starts on the same data directory, then the server stops with the lock error before it listens, and the command still completes', { timeout: 120_000 }, async (t) => {
    const directory = dataDirectory(t);
    const command = CommandProcess.launch(t, selfHostedSettings(directory), ['users', 'add', alice.email]);
    assert.ok(await command.stderrMatches(addPrompt), command.stderr);

    const server = ServerProcess.launch(t, selfHostedSettings(directory));
    const listening = await server.listeningOrExit();
    command.answer([alice.password, alice.password]);

    assert.equal(listening, undefined);
    assert.match(server.output, lockError);
    assertExit(await command.result(), 0);
    assert.deepEqual((await listedAccounts(operatorOn(t, directory))).map(({ email }) => email), [alice.email]);
  });
});
