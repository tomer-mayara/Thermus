import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, test, type TestContext } from 'node:test';
import { applySetCookies } from 'better-auth/cookies';
import { createApplication, HostedEditionUnavailableError, type Application } from '../../../src/application.ts';
import { openBetterAuthRuntime, type BetterAuthRuntime } from '../../../src/auth-better-auth/better-auth-runtime.ts';
import { DataDirectoryInUseError, lockDataDirectory } from '../../../src/auth-better-auth/data-directory-lock.ts';
import { LocalInstallationError } from '../../../src/auth-better-auth/local-installation.ts';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';

type AccountWithStatus = { readonly id: string; readonly email: string; readonly banned?: boolean | null };

const publicBaseUrl = 'http://localhost:8080';
const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class RecordingLogger {
  readonly lines: string[] = [];

  info(message: string): void {
    this.lines.push(message);
  }
}

function dataDirectory(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'magumagu-installation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function selfHostedConfig(directory: string) {
  const config = loadDeploymentConfig({ DEPLOYMENT: 'self-hosted', PUBLIC_BASE_URL: publicBaseUrl, DATA_DIR: directory }, 'http');
  assert.ok(config.deployment === 'self-hosted');
  return config;
}

async function startApplication(t: TestContext, directory: string, logger = new RecordingLogger()): Promise<Application> {
  const application = await createApplication(selfHostedConfig(directory), logger);
  t.after(() => application.close());
  return application;
}

async function withRuntime<T>(directory: string, work: (runtime: BetterAuthRuntime) => Promise<T>): Promise<T> {
  const runtime = await openBetterAuthRuntime(selfHostedConfig(directory));
  try {
    return await work(runtime);
  } finally {
    await runtime.close();
  }
}

async function addAccount(runtime: BetterAuthRuntime, email: string, disabled = false): Promise<string> {
  const { user } = await runtime.auth.api.createUser({ body: { email, password: `${email}-password`, name: email } });
  if (disabled) await (await runtime.auth.$context).internalAdapter.updateUser(user.id, { banned: true });
  return user.id;
}

async function accounts(runtime: BetterAuthRuntime) {
  const users = await (await runtime.auth.$context).internalAdapter.listUsers() as AccountWithStatus[];
  return users.map(({ id, email, banned }) => ({ id, email, disabled: banned === true })).sort((a, b) => a.email.localeCompare(b.email));
}

async function signIn(runtime: BetterAuthRuntime, email: string): Promise<Headers> {
  const { headers } = await runtime.auth.api.signInEmail({ body: { email, password: `${email}-password` }, returnHeaders: true });
  const sessionHeaders = new Headers();
  applySetCookies(sessionHeaders, headers.getSetCookie());
  return sessionHeaders;
}

function mcpRequest(token?: string): Request {
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  return new Request(`${publicBaseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }),
  });
}

function assertLockIsFree(directory: string): void {
  lockDataDirectory(directory).release();
}

function changeDatabase(directory: string, sql: string): void {
  const database = new DatabaseSync(join(directory, 'auth.sqlite'));
  try {
    database.exec(sql);
  } finally {
    database.close();
  }
}

describe('Local installation with the real application and provider', () => {
  test('Given a fresh data directory, when the application starts, then it reports one local tenant, holds the data-directory lock until it closes, and denies MCP requests', async (t) => {
    const directory = dataDirectory(t);
    const logger = new RecordingLogger();

    const application = await startApplication(t, directory, logger);
    const responses = [await application.handle(mcpRequest()), await application.handle(mcpRequest('forged-token'))];
    const unknownRoute = await application.handle(new Request(`${publicBaseUrl}/api/auth/sign-up/email`, { method: 'POST' }));

    const [tenantLine] = logger.lines;
    assert.match(tenantLine ?? '', /^The self-hosted installation uses tenant local:[0-9a-f-]{36}\.$/);
    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', resourceMetadataChallenge);
    }
    assert.equal(unknownRoute.status, 404);
    assert.throws(() => lockDataDirectory(directory), DataDirectoryInUseError);
    await application.close();
    assertLockIsFree(directory);
  });

  test('Given a fresh data directory, when two applications start at the same time, then one starts, the other fails with DataDirectoryInUseError, and one installation identity exists', async (t) => {
    const directory = dataDirectory(t);
    const config = selfHostedConfig(directory);

    const results = await Promise.allSettled([createApplication(config, new RecordingLogger()), createApplication(config, new RecordingLogger())]);
    const started = results.filter((result) => result.status === 'fulfilled');
    const refused = results.filter((result) => result.status === 'rejected');
    for (const { value } of started) t.after(() => value.close());

    assert.equal(started.length, 1);
    assert.equal(refused.length, 1);
    assert.ok(refused[0]?.reason instanceof DataDirectoryInUseError, String(refused[0]?.reason));
    await started[0]?.value.close();
    const ids = await withRuntime(directory, async (runtime) => [runtime.installationId]);
    assert.match(ids[0] ?? '', uuid);
  });

  test('Given an installation with accounts, when the application stops and starts again, then the tenant and every stored user ID stay the same', async (t) => {
    const directory = dataDirectory(t);
    const before = await withRuntime(directory, async (runtime) => {
      await addAccount(runtime, 'alice@example.com');
      await addAccount(runtime, 'bob@example.com', true);
      return { tenantId: runtime.tenantId, accounts: await accounts(runtime) };
    });

    const first = new RecordingLogger();
    await (await createApplication(selfHostedConfig(directory), first)).close();
    const second = new RecordingLogger();
    const application = await startApplication(t, directory, second);
    await application.close();
    const after = await withRuntime(directory, async (runtime) => ({ tenantId: runtime.tenantId, accounts: await accounts(runtime) }));

    assert.deepEqual(after, before);
    assert.deepEqual(first.lines, [`The self-hosted installation uses tenant ${before.tenantId}.`]);
    assert.deepEqual(second.lines, first.lines);
  });

  test('Given an installation with zero accounts or only a disabled account, when the application starts, then startup succeeds, the disabled account cannot sign in, and MCP requests stay denied', async (t) => {
    for (const disabledAccounts of [[], ['dana@example.com']]) {
      const directory = dataDirectory(t);
      await withRuntime(directory, async (runtime) => {
        for (const email of disabledAccounts) await addAccount(runtime, email, true);
      });

      const application = await startApplication(t, directory);
      const response = await application.handle(mcpRequest());
      await application.close();

      assert.equal(response.status, 401);
      await withRuntime(directory, async (runtime) => {
        for (const email of disabledAccounts) {
          await assert.rejects(signIn(runtime, email), (error: { body?: { code?: string } }) => error.body?.code === 'BANNED_USER');
        }
      });
    }
  });

  test('Given a stopped installation, when its complete data directory is copied to a new location, then the copy keeps the installation, the user IDs, and the browser session that its secret signed', async (t) => {
    const original = dataDirectory(t);
    const restored = dataDirectory(t);
    const before = await withRuntime(original, async (runtime) => {
      const userId = await addAccount(runtime, 'alice@example.com');
      return { tenantId: runtime.tenantId, userId, session: await signIn(runtime, 'alice@example.com') };
    });

    cpSync(original, restored, { recursive: true });
    const after = await withRuntime(restored, async (runtime) => ({
      tenantId: runtime.tenantId,
      sessionUserId: (await runtime.auth.api.getSession({ headers: before.session }))?.user.id,
      accounts: await accounts(runtime),
    }));

    assert.equal(after.tenantId, before.tenantId);
    assert.equal(after.sessionUserId, before.userId);
    assert.deepEqual(after.accounts, [{ id: before.userId, email: 'alice@example.com', disabled: false }]);
  });

  test('Given a fresh installation and an enabled account, when the account registers a client through the provider, then the installation owns the client', async (t) => {
    const directory = dataDirectory(t);

    const { installationId, client } = await withRuntime(directory, async (runtime) => {
      await addAccount(runtime, 'alice@example.com');
      const headers = await signIn(runtime, 'alice@example.com');
      const registered = await runtime.auth.api.adminCreateOAuthClient({
        headers,
        body: {
          client_name: 'Native MCP client',
          redirect_uris: ['http://127.0.0.1:33418/callback'],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
          application_type: 'native',
        },
      });
      return { installationId: runtime.installationId, client: registered };
    });

    assert.deepEqual({ reference_id: client.reference_id, user_id: client.user_id }, { reference_id: installationId, user_id: undefined });
  });

  test('Given retained data without its installation identity, when the application starts, then it fails closed and releases the data-directory lock', async (t) => {
    const directory = dataDirectory(t);
    await withRuntime(directory, async () => undefined);
    changeDatabase(directory, 'DELETE FROM "magumagu_installation"');

    await assert.rejects(createApplication(selfHostedConfig(directory), new RecordingLogger()), LocalInstallationError);

    assertLockIsFree(directory);
  });

  test('Given retained data with a damaged provider schema, when the application starts, then the provider schema check stops startup and the application releases the data-directory lock', async (t) => {
    const directory = dataDirectory(t);
    await withRuntime(directory, async () => undefined);
    changeDatabase(directory, 'DROP TABLE "jwks"');

    await assert.rejects(createApplication(selfHostedConfig(directory), new RecordingLogger()), /Database schema mismatch[\s\S]*jwks/);

    assertLockIsFree(directory);
  });

  test('Given the hosted deployment, when the application starts, then it fails with HostedEditionUnavailableError', async () => {
    const config = loadDeploymentConfig({
      DEPLOYMENT: 'hosted',
      PUBLIC_BASE_URL: 'https://magumagu.example',
      WORKOS_AUTHKIT_ISSUER: 'https://magumagu-test.authkit.app',
      WORKOS_CLIENT_ID: 'client_placeholder',
      WORKOS_API_KEY: 'workos-api-key-placeholder',
      WORKOS_REDIRECT_URI: 'https://magumagu.example/auth/callback',
      WORKOS_COOKIE_PASSWORD: 'cookie-password-placeholder-0032',
    }, 'http');

    await assert.rejects(createApplication(config, new RecordingLogger()), HostedEditionUnavailableError);
  });
});
