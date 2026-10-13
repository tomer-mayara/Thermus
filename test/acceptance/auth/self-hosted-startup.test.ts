import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test, type TestContext } from 'node:test';
import { openBetterAuthRuntime } from '../../../src/auth-better-auth/better-auth-runtime.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { ServerProcess, type ServerSettings } from '../../support/server-process.ts';

type AccountWithStatus = { readonly id: string; readonly email: string; readonly banned?: boolean | null };

const publicBaseUrl = 'http://localhost:8080';
const localTenant = /^local:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;

function dataDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'magumagu-data-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function selfHosted(directory: string): ServerSettings {
  return { DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: publicBaseUrl, DATA_DIR: directory, LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
}

function hosted(directory: string): ServerSettings {
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

function localSettings(directory: string) {
  const config = loadDeploymentConfig(selfHosted(directory), 'http');
  assert.ok(config.deployment === 'self-hosted');
  return config;
}

function mcpPost(token?: string): RequestInit {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }) };
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: publicBaseUrl }, body: JSON.stringify(body) };
}

function storedInstallationIds(directory: string): string[] {
  const database = new DatabaseSync(join(directory, 'auth.sqlite'), { readOnly: true });
  try {
    return database.prepare('SELECT "id" FROM "magumagu_installation"').all().map(({ id }) => String(id));
  } finally {
    database.close();
  }
}

function removeInstallationIdentity(directory: string): void {
  const database = new DatabaseSync(join(directory, 'auth.sqlite'));
  try {
    database.exec('DELETE FROM "magumagu_installation"');
  } finally {
    database.close();
  }
}

async function accountsIn(directory: string) {
  const runtime = await openBetterAuthRuntime(localSettings(directory));
  try {
    const accounts = await (await runtime.auth.$context).internalAdapter.listUsers() as AccountWithStatus[];
    return accounts.map(({ id, email, banned }) => ({ id, email, disabled: banned === true }));
  } finally {
    await runtime.close();
  }
}

async function addDisabledAccount(directory: string, email: string): Promise<string> {
  const runtime = await openBetterAuthRuntime(localSettings(directory));
  try {
    const { user } = await runtime.auth.api.createUser({ body: { email, password: 'disabled-password-1', name: email } });
    await (await runtime.auth.$context).internalAdapter.updateUser(user.id, { banned: true });
    return user.id;
  } finally {
    await runtime.close();
  }
}

async function assertStopsBeforeListening(server: ServerProcess, message: RegExp): Promise<void> {
  assert.equal(await server.listeningOrExit(), undefined, server.output);
  assert.notEqual((await server.exited()).code, 0);
  assert.match(server.output, message);
}

describe('Self-hosted server startup with one persistent installation', () => {
  test('Given a fresh data directory, when the server starts, stops, and starts again, then one installation identity persists and both runs report the same local tenant', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const first = await ServerProcess.start(t, selfHosted(directory));
    const firstTenant = first.tenant();
    const firstExit = await first.stop();
    const second = await ServerProcess.start(t, selfHosted(directory));
    const secondTenant = second.tenant();
    const secondExit = await second.stop();

    assert.match(firstTenant, localTenant);
    assert.equal(secondTenant, firstTenant);
    assert.deepEqual([firstExit, secondExit], [{ code: 0, signal: null }, { code: 0, signal: null }]);
    assert.deepEqual(storedInstallationIds(directory), [firstTenant.slice('local:'.length)]);
  });

  test('Given a fresh installation with zero accounts, when the server starts, then startup succeeds, MCP requests get a Bearer challenge, and no public route creates an account', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const server = await ServerProcess.start(t, selfHosted(directory));
    const withoutToken = await server.request('/mcp', mcpPost());
    const withForgedToken = await server.request('/mcp', mcpPost('forged-token'));
    const signUp = await server.request('/api/auth/sign-up/email', jsonPost({ email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' }));
    const adminCreate = await server.request('/api/auth/admin/create-user', jsonPost({ email: 'eve@example.com', password: 'eve-password-1', name: 'Eve' }));
    await server.stop();

    for (const response of [withoutToken, withForgedToken]) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', resourceMetadataChallenge);
    }
    assert.ok(signUp.status >= 400, `sign-up gave ${signUp.status}`);
    assert.ok(adminCreate.status >= 400, `admin create-user gave ${adminCreate.status}`);
    assert.deepEqual(await accountsIn(directory), []);
  });

  test('Given an installation whose only account is disabled, when the server starts, then startup succeeds, MCP requests stay denied, and the account keeps its ID', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    const disabledId = await addDisabledAccount(directory, 'dana@example.com');

    const server = await ServerProcess.start(t, selfHosted(directory));
    const response = await server.request('/mcp', mcpPost());
    await server.stop();

    assert.equal(response.status, 401);
    assert.deepEqual(await accountsIn(directory), [{ id: disabledId, email: 'dana@example.com', disabled: true }]);
  });

  test('Given a fresh data directory, when two servers start at the same time, then one serves, the other stops with a lock error before it listens, and one installation identity exists', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const servers = [ServerProcess.launch(t, selfHosted(directory)), ServerProcess.launch(t, selfHosted(directory))];
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

  test('Given retained authentication data without its installation identity, when the server starts, then it stops before it listens, asks for operator recovery, and creates no new identity', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);
    await (await ServerProcess.start(t, selfHosted(directory))).stop();
    removeInstallationIdentity(directory);

    const server = ServerProcess.launch(t, selfHosted(directory));

    await assertStopsBeforeListening(server, /installation identity/i);
    assert.match(server.output, /restore/i);
    assert.deepEqual(storedInstallationIds(directory), []);
  });

  test('Given a stopped installation, when its complete data directory is restored to a new location, then the server starts there with the same tenant; a restore without the secret stops before it listens', { timeout: 60_000 }, async (t) => {
    const original = dataDirectory(t);
    const restored = dataDirectory(t);
    const withoutSecret = dataDirectory(t);
    const source = await ServerProcess.start(t, selfHosted(original));
    const tenant = source.tenant();
    await source.stop();
    cpSync(original, restored, { recursive: true });
    cpSync(original, withoutSecret, { recursive: true });
    rmSync(join(withoutSecret, 'auth.secret'));

    const server = await ServerProcess.start(t, selfHosted(restored));
    const restoredTenant = server.tenant();
    await server.stop();
    const partial = ServerProcess.launch(t, selfHosted(withoutSecret));

    assert.equal(restoredTenant, tenant);
    await assertStopsBeforeListening(partial, /secret/i);
  });

  test('Given the hosted edition with a data directory setting, when the server starts, then it stops with an unavailable-edition error and creates no local data', { timeout: 60_000 }, async (t) => {
    const directory = dataDirectory(t);

    const server = ServerProcess.launch(t, hosted(directory));

    await assertStopsBeforeListening(server, /hosted edition/i);
    assert.deepEqual(readdirSync(directory), []);
  });
});
