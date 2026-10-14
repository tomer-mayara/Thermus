import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import type { AccountCredentials } from '../../support/better-auth-local.ts';
import { assertExit } from '../../support/command-process.ts';
import { dataDirectory } from '../../support/data-directory.ts';
import { addUser, listedAccounts, operatorOn } from '../../support/local-commands.ts';
import { selfHostedServerSettings, selfHostedSettings } from '../../support/local-runtime.ts';
import { failingAdCleaner, nativeFailureMarker, withPreload } from '../../support/server-preloads.ts';
import { ServerProcess } from '../../support/server-process.ts';

const ada: AccountCredentials = { email: 'ada@example.com', password: 'ada-password-1' };
const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;
const pathMarker = 'private-path-marker';
const ruleMarker = 'private-rule-marker';
const missingSetting = 'AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.';
// The bytes C3 28 are not UTF-8. The rule before them shows in the output if the server writes the file contents.
const notUtf8 = Buffer.concat([Buffer.from(`example.com##.${ruleMarker}\n`), Buffer.from([0xc3, 0x28, 0x0a])]);
// The console logger writes "[time] FATAL [call site]: message" and colors the label.
const fatalLine = /^\[[^\]]*\] FATAL (?:\[[^\]]*\]: )?(.*)$/gm;

interface RefusedRules {
  readonly setting: string;
  readonly message: string;
  // Gives the AD_RULES_FILE value for a fresh empty directory, or undefined when the setting is not set.
  readonly value: (directory: string) => string | undefined;
}

const refusedRules: readonly RefusedRules[] = [
  { setting: 'is not set', message: missingSetting, value: () => undefined },
  { setting: 'is empty', message: missingSetting, value: () => '' },
  { setting: 'is a relative path', message: 'AD_RULES_FILE must be an absolute path.', value: () => `${pathMarker}/ad-rules.txt` },
  { setting: 'names a missing file', message: 'AD_RULES_FILE could not be read (ENOENT).', value: (directory) => join(directory, `${pathMarker}.txt`) },
  { setting: 'names a directory', message: 'AD_RULES_FILE could not be read (EISDIR).', value: (directory) => madeDirectory(join(directory, pathMarker)) },
  { setting: 'names a file that is not UTF-8 text', message: 'AD_RULES_FILE must contain UTF-8 text.', value: (directory) => writtenFile(join(directory, `${pathMarker}.txt`), notUtf8) },
];

const noOpRules = [
  { file: 'an empty file', contents: '' },
  { file: 'a file with only a comment', contents: '! No rules\n' },
];

function writtenFile(path: string, contents: string | Uint8Array): string {
  writeFileSync(path, contents);
  return path;
}

function madeDirectory(path: string): string {
  mkdirSync(path);
  return path;
}

function mcpToolCall(): RequestInit {
  const call = { name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/', reason: 'Read the page for this task' } };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: call }),
  };
}

function fatalMessages(output: string): string[] {
  return Array.from(stripVTControlCharacters(output).matchAll(fatalLine), ([, message]) => message ?? '');
}

function dataFiles(directory: string): Record<string, Buffer> {
  return Object.fromEntries(readdirSync(directory).map((name) => [name, readFileSync(join(directory, name))]));
}

async function assertStopsWithFatal(server: ServerProcess, message: string): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.deepEqual(await server.exited(), { code: 1, signal: null }, server.output);
  assert.deepEqual(fatalMessages(server.output), [message], server.output);
  assert.doesNotMatch(server.output, /Listening on/);
}

describe('Self-hosted server startup with the ad rules file', () => {
  for (const { setting, message, value } of refusedRules) {
    test(`Given AD_RULES_FILE ${setting}, when the server starts on a fresh data directory, then it stops with status 1 before it listens, its only FATAL line is "${message}", it shows no path or rule text, and it creates no data`, { timeout: 60_000 }, async (t) => {
      const directory = dataDirectory(t);
      const adRulesFile = value(dataDirectory(t));
      const settings = adRulesFile === undefined ? selfHostedSettings(directory) : selfHostedServerSettings(directory, adRulesFile);

      const server = ServerProcess.launch(t, settings);

      await assertStopsWithFatal(server, message);
      for (const marker of [pathMarker, ruleMarker]) assert.ok(!server.output.includes(marker), `The output shows ${marker}:\n${server.output}`);
      assert.deepEqual(readdirSync(directory), []);
    });
  }

  test('Given an installation with one account and AD_RULES_FILE that names a missing file, when the server starts, then it stops with status 1 before it listens, changes no data file, and a later users list command shows the account', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const operator = operatorOn(t, directory);
    assertExit(await addUser(operator, ada), 0);
    const before = dataFiles(directory);

    const server = ServerProcess.launch(t, selfHostedServerSettings(directory, join(dataDirectory(t), 'missing-ad-rules.txt')));

    await assertStopsWithFatal(server, 'AD_RULES_FILE could not be read (ENOENT).');
    assert.deepEqual(dataFiles(directory), before);
    const accounts = await listedAccounts(operator);
    assert.deepEqual(accounts.map(({ email, state }) => ({ email, state })), [{ email: ada.email, state: 'enabled' }]);
  });

  test('Given trusted rules and a native rule parser that fails with a private message, when the server starts, then it stops with status 1 before it listens, its only FATAL line is "The ad cleaner could not load the rules in AD_RULES_FILE.", it does not show the private message, and it creates no data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const server = ServerProcess.launch(t, withPreload(selfHostedServerSettings(directory), failingAdCleaner));

    await assertStopsWithFatal(server, 'The ad cleaner could not load the rules in AD_RULES_FILE.');
    assert.ok(!server.output.includes(nativeFailureMarker), `The output shows the native error:\n${server.output}`);
    assert.deepEqual(readdirSync(directory), []);
  });

  for (const { file, contents } of noOpRules) {
    test(`Given AD_RULES_FILE that names ${file}, when the server starts on a fresh data directory, then it listens, an MCP request without a token gets the Bearer challenge, and SIGTERM stops it with status 0`, { timeout: 60_000 }, async (t) => {
      const adRulesFile = writtenFile(join(dataDirectory(t), 'ad-rules.txt'), contents);

      const server = await ServerProcess.start(t, selfHostedServerSettings(dataDirectory(t), adRulesFile));
      const response = await server.request('/mcp', mcpToolCall());
      const exit = await server.stop();

      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', resourceMetadataChallenge);
      assert.deepEqual(exit, { code: 0, signal: null });
    });
  }

  test('Given trusted rules and LIGHTPANDA_BIN that names a missing executable, when the server starts on a fresh data directory, then it listens, because startup does not run or check the renderer, and SIGTERM stops it with status 0', { timeout: 60_000 }, async (t) => {
    const settings = { ...selfHostedServerSettings(dataDirectory(t)), LIGHTPANDA_BIN: join(dataDirectory(t), 'missing-lightpanda') };

    const server = await ServerProcess.start(t, settings);
    const exit = await server.stop();

    assert.deepEqual(exit, { code: 0, signal: null });
  });
});
