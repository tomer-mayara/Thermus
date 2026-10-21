import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { stripVTControlCharacters } from 'node:util';
import type { AccountCredentials } from '../../support/in-process/better-auth-local.ts';
import { assertExit, runCommand } from '../../support/processes/command-process.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { hostedFetchSettings, hostedStartupLine, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { addUser, registerArgs, type Operator } from '../../support/dsl/local-commands.ts';
import { selfHostedServerSettings, selfHostedSettings } from '../../support/in-process/local-runtime.ts';
import { withPreload } from '../../support/processes/server-preloads.ts';
import { ServerProcess, type ServerSettings } from '../../support/processes/server-process.ts';

const ada: AccountCredentials = { email: 'ada@example.com', password: 'ada-password-1' };
const bob: AccountCredentials = { email: 'bob@example.com', password: 'bob-password-1' };
// The console logger writes "[time] FATAL [call site]: message" and colors the label.
const fatalLine = /^\[[^\]]*\] FATAL (?:\[[^\]]*\]: )?(.*)$/gm;

// Only an HTTP or stdio server can load the rules file reader, the renderer, the ad cleaner, and the cleaning pipeline.
const blocked = 'The test blocked a server-only module';
const rendererReport = 'Renderer setup failure';
const serverOnlyModuleGuard = `data:text/javascript,${encodeURIComponent(`import { registerHooks } from 'node:module';
const serverOnly = (url) => /\\/src\\/(?:runtime\\/config\\/ad-rules-file|pipelines\\/providers\\/website-fetcher\\/website-fetcher-lightpanda|app\\/hosted-renderer-startup|app\\/hosted-portal)\\.(?:js|ts)$/.test(url)
  || ['/src/pipelines/html-processing/', '/adblock-rs/'].some((part) => url.includes(part));
registerHooks({ resolve(specifier, context, nextResolve) {
  const result = nextResolve(specifier, context);
  if (serverOnly(result.url)) throw new Error(${JSON.stringify(blocked)});
  return result;
} });`)}`;

function hostedSettings(directory: string): ServerSettings {
  return {
    ...hostedFetchSettings,
    DEPLOYMENT: 'hosted',
    PUBLIC_BASE_URL: 'https://thermus.example',
    ...workOSSettings,
    DATA_DIR: directory,
    LISTEN_HOST: '127.0.0.1',
    LISTEN_PORT: '0',
  };
}

// The operator commands must not need the rules file or the renderer.
function guardedSettings(settings: ServerSettings, emptyDirectory: string): ServerSettings {
  const missing = { AD_RULES_FILE: join(emptyDirectory, 'missing-ad-rules.txt'), LIGHTPANDA_BIN: join(emptyDirectory, 'missing-lightpanda') };
  return withPreload({ ...settings, ...missing }, serverOnlyModuleGuard);
}

function mcpToolCall(headers: Readonly<Record<string, string>> = {}): RequestInit {
  const call = { name: 'getURLAsMarkdown', arguments: { url: 'https://example.com/', reason: 'Read the page for this task' } };
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: call }),
  };
}

function fatalMessages(output: string): string[] {
  return Array.from(stripVTControlCharacters(output).matchAll(fatalLine), ([, message]) => message ?? '');
}

describe('Modules that only servers load', () => {
  test('Given a guard against server-only modules, a missing rules file, and a missing renderer, when the operator adds two users, lists them, registers a client, resets a password, and disables a user on a fresh data directory, then each command exits with status 0, loads no server-only module, and writes no renderer setup report', { timeout: 60_000 }, async (t) => {
    const settings = guardedSettings(selfHostedSettings(dataDirectory(t)), dataDirectory(t));
    const operator: Operator = (args, input = []) => runCommand(t, settings, { args, input });

    const results = [
      await addUser(operator, ada),
      await addUser(operator, bob),
      await operator(['users', 'list']),
      await operator(registerArgs(ada), [ada.password]),
      await operator(['users', 'reset-password', ada.email], ['ada-password-2', 'ada-password-2']),
      await operator(['users', 'disable', bob.email]),
    ];

    for (const result of results) {
      assertExit(result, 0);
      for (const text of [blocked, rendererReport]) assert.ok(!`${result.stdout}${result.stderr}`.includes(text), result.stderr);
    }
  });

  test('Given trusted rules, a portal, and a pinned renderer version double, when the hosted edition starts with valid WorkOS settings, then the public portal opens, account and MCP stay protected, and the server uses no network or local data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const settings = hostedSettings(directory);
    const server = await ServerProcess.start(t, settings);
    const page = await server.request('/');
    const pageText = await page.text();
    const account = await server.request('/account');
    const mcp = await server.request('/mcp', mcpToolCall({ Authorization: 'Bearer any-token', Cookie: 'wos-session=any-session' }));
    await mcp.text();
    const exit = await server.stop();

    assert.deepEqual([page.status, account.status, mcp.status], [200, 401, 401]);
    assert.match(pageText, /Thermus hosted portal fixture/);
    assert.match(mcp.headers.get('WWW-Authenticate') ?? '', /^Bearer /);
    assert.ok(server.output.includes(hostedStartupLine), server.output);
    assert.ok(!server.output.includes(rendererReport), server.output);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
    assert.deepEqual(exit, { code: 0, signal: null });
    assert.deepEqual(readdirSync(directory), []);
  });

  test('Given a guard against fetch modules, when hosted startup has valid WorkOS settings, then it stops before listening because hosted startup now composes the renderer and native cleaner', { timeout: 60_000 }, async (t) => {
    const server = ServerProcess.launch(t, withPreload(hostedSettings(dataDirectory(t)), serverOnlyModuleGuard));
    assert.equal(await server.listeningOrExit(), undefined, server.output);
    assert.deepEqual(await server.exited(), { code: 1, signal: null }, server.output);
    assert.ok(fatalMessages(server.output).some((message) => message.includes(blocked)), server.output);
  });

  test('Given a guard against server-only modules and trusted rules, when the self-hosted server starts, then it stops with status 1 before it listens and its FATAL line shows the guard message, so the guard sees the modules that the server loads', { timeout: 60_000 }, async (t) => {
    const server = ServerProcess.launch(t, withPreload(selfHostedServerSettings(dataDirectory(t)), serverOnlyModuleGuard));

    assert.equal(await server.listeningOrExit(), undefined, server.output);
    assert.deepEqual(await server.exited(), { code: 1, signal: null }, server.output);
    assert.ok(fatalMessages(server.output).some((message) => message.includes(blocked)), server.output);
  });
});
