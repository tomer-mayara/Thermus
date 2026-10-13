import assert from 'node:assert/strict';
import { cpSync } from 'node:fs';
import { describe, test } from 'node:test';
import { applySetCookies } from 'better-auth/cookies';
import { createApplication, HostedEditionUnavailableError } from '../../../src/application.js';
import { DataDirectoryInUseError, lockDataDirectory } from '../../../src/auth-better-auth/data-directory-lock.js';
import { LocalInstallationError } from '../../../src/auth-better-auth/local-installation.js';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.js';
import { publicBaseUrl } from '../../support/better-auth-local.js';
import { changeDatabase, dataDirectory, storedInstallationIds } from '../../support/data-directory.js';
import { accountsOf, addAccount, passwordOf, selfHostedConfig, withRuntime } from '../../support/local-runtime.js';
const resourceMetadataChallenge = /^Bearer .*resource_metadata="http:\/\/localhost:8080\/\.well-known\/oauth-protected-resource\/mcp"/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
class RecordingLogger {
    lines = [];
    info = (message) => { this.lines.push(message); };
    error = (message) => { this.lines.push(`ERROR ${message}`); };
}
async function startApplication(t, directory, logger = new RecordingLogger()) {
    const application = await createApplication(selfHostedConfig(directory), logger);
    t.after(() => application.close());
    return application;
}
async function signIn(runtime, email) {
    const { headers } = await runtime.auth.api.signInEmail({ body: { email, password: passwordOf(email) }, returnHeaders: true });
    const sessionHeaders = new Headers();
    applySetCookies(sessionHeaders, headers.getSetCookie());
    return sessionHeaders;
}
function mcpRequest(token) {
    const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' });
    if (token !== undefined)
        headers.set('Authorization', `Bearer ${token}`);
    return new Request(`${publicBaseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} }),
    });
}
function assertLockIsFree(directory) {
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
        const results = await Promise.allSettled([createApplication(config, new RecordingLogger()), createApplication(config, new RecordingLogger())]);
        const started = results.filter((result) => result.status === 'fulfilled');
        const refused = results.filter((result) => result.status === 'rejected');
        for (const { value } of started)
            t.after(() => value.close());
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
        await (await createApplication(selfHostedConfig(directory), first)).close();
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
                for (const email of disabledAccounts)
                    await addAccount(runtime, email, true);
            });
            const application = await startApplication(t, directory);
            const response = await application.handle(mcpRequest());
            await application.close();
            assert.equal(response.status, 401);
            await withRuntime(directory, async (runtime) => {
                for (const email of disabledAccounts) {
                    await assert.rejects(signIn(runtime, email), (error) => error.body?.code === 'BANNED_USER');
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
        { label: 'without its installation identity', damage: 'DELETE FROM "magumagu_installation"', failure: LocalInstallationError },
        { label: 'with a damaged provider schema', damage: 'DROP TABLE "jwks"', failure: /Database schema mismatch[\s\S]*jwks/ },
    ]) {
        test(`Given retained data ${label}, when the application starts, then startup fails closed and releases the data-directory lock`, async (t) => {
            const directory = dataDirectory(t);
            await withRuntime(directory, async () => undefined);
            changeDatabase(directory, damage);
            await assert.rejects(createApplication(selfHostedConfig(directory), new RecordingLogger()), failure);
            assertLockIsFree(directory);
        });
    }
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
//# sourceMappingURL=local-installation.test.js.map