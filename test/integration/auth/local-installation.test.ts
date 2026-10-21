import assert from 'node:assert/strict';
import '../../support/processes/use-hosted-portal-fixture.ts';
import { cpSync } from 'node:fs';
import { describe, test, type TestContext } from 'node:test';
import { applySetCookies } from 'better-auth/cookies';
import { createApplication, type Application } from '../../../src/app/application.ts';
import type { BetterAuthRuntime } from '../../../src/accounts/providers/better-auth/better-auth-runtime.ts';
import { DataDirectoryInUseError, lockDataDirectory } from '../../../src/accounts/providers/better-auth/data-directory-lock.ts';
import { LocalInstallationError } from '../../../src/accounts/providers/better-auth/local-installation.ts';
import { publicBaseUrl } from '../../support/in-process/better-auth-local.ts';
import { changeDatabase, dataDirectory, storedInstallationIds } from '../../support/isolation/data-directory.ts';
import { hostedFetchSettings, hostedStartupLine, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { WorkOSSettingsError } from '../../../src/accounts/providers/workos/workos-settings.ts';
import { accountsOf, addAccount, passwordOf, selfHostedConfig, selfHostedServerSettings, withRuntime } from '../../support/in-process/local-runtime.ts';

const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class RecordingLogger {
  readonly lines: string[] = [];
  readonly info = (message: string): void => { this.lines.push(message); };
  readonly error = (message: string): void => { this.lines.push(`ERROR ${message}`); };
}

async function startApplication(t: TestContext, directory: string, logger = new RecordingLogger()): Promise<Application> {
  const application = await createApplication(selfHostedConfig(directory), logger, selfHostedServerSettings(directory));
  t.after(() => application.close());
  return application;
}

async function signIn(runtime: BetterAuthRuntime, email: string): Promise<Headers> {
  const { headers } = await runtime.auth.api.signInEmail({ body: { email, password: passwordOf(email) }, returnHeaders: true });
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

describe('Local installation with the real application and provider', () => {
  test('Given a fresh data directory, when the application starts, then it reports one local tenant, holds the data-directory lock until it closes, and denies MCP requests without a failure report', async (t) => {
    const directory = dataDirectory(t);
    const logger = new RecordingLogger();

    const application = await startApplication(t, directory, logger);
    const responses = [await application.handle(mcpRequest()), await application.handle(mcpRequest('forged-token'))];
    const unknownRoute = await application.handle(new Request(`${publicBaseUrl}/api/auth/sign-up/email`, { method: 'POST' }));

    const [installationId] = storedInstallationIds(directory);
    assert.match(installationId ?? '', uuid);
    assert.deepEqual(logger.lines, [`The self-hosted installation uses tenant local:${installationId}.`]);
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

    const settings = selfHostedServerSettings(directory);
    const results = await Promise.allSettled([createApplication(config, new RecordingLogger(), settings), createApplication(config, new RecordingLogger(), settings)]);
    const started = results.filter((result) => result.status === 'fulfilled');
    const refused = results.filter((result) => result.status === 'rejected');
    for (const { value } of started) t.after(() => value.close());

    assert.equal(started.length, 1);
    assert.equal(refused.length, 1);
    assert.ok(refused[0]?.reason instanceof DataDirectoryInUseError, String(refused[0]?.reason));
    assert.equal(storedInstallationIds(directory).length, 1);
  });

  test('Given an installation with accounts, when the application stops and starts again, then the tenant and every stored user ID stay the same', async (t) => {
    const directory = dataDirectory(t);
    const before = await withRuntime(directory, async (runtime) => {
      await addAccount(runtime, 'alice@example.com');
      await addAccount(runtime, 'bob@example.com', true);
      return { tenantId: runtime.tenantId, accounts: await accountsOf(runtime) };
    });

    const first = new RecordingLogger();
    await (await createApplication(selfHostedConfig(directory), first, selfHostedServerSettings(directory))).close();
    const second = new RecordingLogger();
    await (await startApplication(t, directory, second)).close();
    const after = await withRuntime(directory, async (runtime) => ({ tenantId: runtime.tenantId, accounts: await accountsOf(runtime) }));

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
      accounts: await accountsOf(runtime),
    }));

    assert.equal(after.tenantId, before.tenantId);
    assert.equal(after.sessionUserId, before.userId);
    assert.deepEqual(after.accounts, [{ id: before.userId, email: 'alice@example.com', disabled: false }]);
  });

  test('Given a fresh installation and an enabled account, when the account registers a client through the provider, then the installation owns the client', async (t) => {
    const directory = dataDirectory(t);

    const { installationId, client } = await withRuntime(directory, async (runtime) => {
      await addAccount(runtime, 'alice@example.com');
      const registered = await runtime.auth.api.adminCreateOAuthClient({
        headers: await signIn(runtime, 'alice@example.com'),
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

  for (const { label, damage, failure } of [
    { label: 'without its installation identity', damage: 'DELETE FROM "thermus_installation"', failure: LocalInstallationError },
    { label: 'with a damaged provider schema', damage: 'DROP TABLE "jwks"', failure: /Database schema mismatch[\s\S]*jwks/ },
  ]) {
    test(`Given retained data ${label}, when the application starts, then startup fails closed and releases the data-directory lock`, async (t) => {
      const directory = dataDirectory(t);
      await withRuntime(directory, async () => undefined);
      changeDatabase(directory, damage);

      await assert.rejects(createApplication(selfHostedConfig(directory), new RecordingLogger(), selfHostedServerSettings(directory)), failure);

      assertLockIsFree(directory);
    });
  }

  test('Given the hosted deployment, when the application starts, then it selects the WorkOS provider instead of the local runtime: without the WorkOS settings it refuses to start, and with them account and MCP requests without credentials get 401, and repeated closes give one result', async () => {
    await assert.rejects(createApplication(hostedRootConfig, new RecordingLogger(), {}), WorkOSSettingsError);
    const logger = new RecordingLogger();
    const application = await createApplication(hostedRootConfig, logger, { ...workOSSettings, ...hostedFetchSettings });

    const answers = [await application.handle(new Request('https://thermus.example/account')), await application.handle(mcpRequest('forged-token'))];
    const closes = [application.close(), application.close()];

    assert.deepEqual([answers.map(({ status }) => status), closes[0] === closes[1]], [[401, 401], true]);
    await Promise.all(closes);
    assert.deepEqual(logger.lines, [hostedStartupLine]);
  });
});
