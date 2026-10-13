import assert from 'node:assert/strict';
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { publicBaseUrl } from '../../support/better-auth-local.ts';
import { changeDatabase, dataDirectory, storedInstallationIds } from '../../support/data-directory.ts';
import { accountsOf, addAccount, selfHostedSettings, withRuntime } from '../../support/local-runtime.ts';
import { ServerProcess, type ServerSettings } from '../../support/server-process.ts';

const localTenant = /^local:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;
const refusedProviderVariables: ServerSettings = {
  BETTER_AUTH_SECRETS: '1:environment-secret-0123456789abcdef0123456789',
  BETTER_AUTH_TRUSTED_ORIGINS: 'https://foreign-origin.example',
  BETTER_AUTH_TELEMETRY: 'telemetry-from-the-environment',
};

function hostedSettings(directory: string): ServerSettings {
  return {
    DEPLOYMENT: 'hosted',
    PUBLIC_BASE_URL: 'https://magumagu.example',
    WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
    WORKOS_CLIENT_ID: 'client_placeholder',
    WORKOS_API_KEY: 'workos-api-key-placeholder',
    WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
    WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
    DATA_DIR: directory,
    LISTEN_HOST: '127.0.0.1',
    LISTEN_PORT: '0',
  };
}

function mcpPost(token?: string): RequestInit {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }) };
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: publicBaseUrl }, body: JSON.stringify(body) };
}

function dataFiles(directory: string): Record<string, Buffer> {
  return Object.fromEntries(readdirSync(directory).map((name) => [name, readFileSync(join(directory, name))]));
}

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

describe('Self-hosted server startup with one persistent installation', () => {
  test('Given a fresh data directory, when the server starts, stops, and starts again, then one installation identity persists and both runs report the same local tenant', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const first = await ServerProcess.start(t, selfHostedSettings(directory));
    const firstTenant = first.tenant();
    const firstExit = await first.stop();
    const second = await ServerProcess.start(t, selfHostedSettings(directory));
    const secondTenant = second.tenant();
    const secondExit = await second.stop();

    assert.match(firstTenant, localTenant);
    assert.equal(secondTenant, firstTenant);
    assert.deepEqual([firstExit, secondExit], [{ code: 0, signal: null }, { code: 0, signal: null }]);
    assert.deepEqual(storedInstallationIds(directory), [firstTenant.slice('local:'.length)]);
  });

  test('Given a fresh installation with zero accounts, when the server starts, then startup succeeds, MCP requests get a Bearer challenge, and no public route creates an account', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const account = { email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' };

    const server = await ServerProcess.start(t, selfHostedSettings(directory));
    const withoutToken = await server.request('/mcp', mcpPost());
    const withForgedToken = await server.request('/mcp', mcpPost('forged-token'));
    const signUp = await server.request('/api/auth/sign-up/email', jsonPost(account));
    const adminCreate = await server.request('/api/auth/admin/create-user', jsonPost(account));
    await server.stop();

    for (const response of [withoutToken, withForgedToken]) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', resourceMetadataChallenge);
    }
    assert.ok(signUp.status >= 400, `sign-up gave ${signUp.status}`);
    assert.ok(adminCreate.status >= 400, `admin create-user gave ${adminCreate.status}`);
    assert.deepEqual(await withRuntime(directory, accountsOf), []);
  });

  test('Given an installation whose only account is disabled, when the server starts, then startup succeeds, MCP requests stay denied, and the account keeps its ID', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const disabledId = await withRuntime(directory, (runtime) => addAccount(runtime, 'dana@example.com', true));

    const server = await ServerProcess.start(t, selfHostedSettings(directory));
    const response = await server.request('/mcp', mcpPost());
    await server.stop();

    assert.equal(response.status, 401);
    assert.deepEqual(await withRuntime(directory, accountsOf), [{ id: disabledId, email: 'dana@example.com', disabled: true }]);
  });

  test('Given a fresh data directory, when two servers start at the same time, then one serves, the other stops with a lock error before it listens, and one installation identity exists', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const servers = [ServerProcess.launch(t, selfHostedSettings(directory)), ServerProcess.launch(t, selfHostedSettings(directory))];
    const outcomes = await Promise.all(servers.map((server) => server.listeningOrExit()));
    const running = servers.filter((_, index) => outcomes[index] !== undefined);
    const refused = servers.filter((_, index) => outcomes[index] === undefined);

    assert.equal(running.length, 1, servers.map(({ output }) => output).join('\n'));
    assert.equal(refused.length, 1);
    const [server] = running as [ServerProcess];
    await assertStopsBeforeListening(refused[0] as ServerProcess, /in use by another/i);
    assert.equal((await server.request('/mcp', mcpPost())).status, 401);
    const tenant = server.tenant();
    await server.stop();
    assert.deepEqual(storedInstallationIds(directory), [tenant.slice('local:'.length)]);
  });

  test('Given a running server, when another server starts with the same data directory, then it stops with a lock error before it listens, within five seconds, and changes no data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const server = await ServerProcess.start(t, selfHostedSettings(directory));
    const before = dataFiles(directory);
    const launched = performance.now();

    await assertStopsBeforeListening(ServerProcess.launch(t, selfHostedSettings(directory)), /in use by another/i);
    const refusedAfter = performance.now() - launched;

    assert.ok(refusedAfter < 5_000, `The second server stopped after ${refusedAfter} ms`);
    assert.deepEqual(dataFiles(directory), before);
    assert.equal((await server.request('/mcp', mcpPost())).status, 401);
    await server.stop();
  });

  test('Given retained authentication data without its installation identity, when the server starts, then it stops before it listens, asks for operator recovery, and creates no new identity', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    await (await ServerProcess.start(t, selfHostedSettings(directory))).stop();
    changeDatabase(directory, 'DELETE FROM "magumagu_installation"');

    const server = ServerProcess.launch(t, selfHostedSettings(directory));

    await assertStopsBeforeListening(server, /installation identity/i);
    assert.match(server.output, /restore/i);
    assert.deepEqual(storedInstallationIds(directory), []);
  });

  test('Given a stopped installation, when its complete data directory is restored to a new location, then the server starts there with the same tenant; a restore without the secret stops before it listens', { timeout: 60_000 }, async (t) => {
    const original = dataDirectory(t);
    const restored = dataDirectory(t);
    const withoutSecret = dataDirectory(t);
    const source = await ServerProcess.start(t, selfHostedSettings(original));
    const tenant = source.tenant();
    await source.stop();
    cpSync(original, restored, { recursive: true });
    cpSync(original, withoutSecret, { recursive: true });
    rmSync(join(withoutSecret, 'auth.secret'));

    const server = await ServerProcess.start(t, selfHostedSettings(restored));
    const restoredTenant = server.tenant();
    await server.stop();
    const partial = ServerProcess.launch(t, selfHostedSettings(withoutSecret));

    assert.equal(restoredTenant, tenant);
    await assertStopsBeforeListening(partial, /secret/i);
  });

  test('Given a Better Auth variable that the self-hosted runtime refuses, when the server starts, then it stops before it listens with an error that names the variable but not its value', { timeout: 60_000 }, async (t) => {
    for (const [variable, value] of Object.entries(refusedProviderVariables)) {
      const server = ServerProcess.launch(t, { ...selfHostedSettings(dataDirectory(t)), [variable]: value });

      await assertStopsBeforeListening(server, new RegExp(`FATAL.*${variable}`));
      assert.ok(!server.output.includes(value), `The output shows the value of ${variable}:\n${server.output}`);
    }
  });

  test('Given an unknown command, when the process starts, then it stops with status 2 before it listens and creates no local data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const server = ServerProcess.launch(t, selfHostedSettings(directory), ['users', 'promote', 'alice@example.com']);

    assert.equal(await server.listeningOrExit(), undefined, server.output);
    assert.deepEqual(await server.exited(), { code: 2, signal: null });
    assert.match(server.output, /Unknown command/);
    assert.doesNotMatch(server.output, /alice@example\.com/);
    assert.deepEqual(readdirSync(directory), []);
  });

  test('Given the hosted edition with a data directory setting, when the server starts, then it serves only the authentication-unavailable notice, reports no local tenant, and creates no local data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const server = await ServerProcess.start(t, hostedSettings(directory));
    const notice = await server.request('/');
    const mcp = await server.request('/mcp', mcpPost('forged-token'));
    const exit = await server.stop();

    assert.deepEqual([notice.status, mcp.status], [503, 503]);
    assert.match(await notice.text(), /Hosted authentication is not available yet\./);
    assert.doesNotMatch(server.output, /tenant/);
    assert.deepEqual(exit, { code: 0, signal: null });
    assert.deepEqual(readdirSync(directory), []);
  });
});
