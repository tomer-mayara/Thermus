import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hostedFetchSettings, workOSSettings } from '../../../support/fixtures/hosted-placeholder.ts';
import { dataDirectory } from '../../../support/isolation/data-directory.ts';
import { selfHostedServerSettings } from '../../../support/in-process/local-runtime.ts';
import { withPreload } from '../../../support/processes/server-preloads.ts';
import { ServerProcess } from '../../../support/processes/server-process.ts';

const storageCases: readonly Readonly<Record<string, string>>[] = [{}, { DATABASE_URL: 'postgresql://secret-user:secret-password@db.example/logging?sslmode=disable', LOGGING_DESTINATION_ENCRYPTION_KEY: 'secret-invalid-key' }];

for (const storage of storageCases) {
  test('Given missing or invalid logging storage settings, when the hosted server starts, then MCP metadata remains available and shutdown completes without storage network work', { timeout: 15_000 }, async (t) => {
    const server = await ServerProcess.start(t, {
      ...hostedFetchSettings, ...workOSSettings, ...storage,
      DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0',
    });
    assert.equal((await server.request('/.well-known/oauth-protected-resource/mcp')).status, 200);
    assert.equal(await (await server.request('/healthz')).text(), 'ok\n');
    assert.match(server.output, /Logging storage is unavailable/);
    assert.doesNotMatch(server.output, /secret-user|secret-password|secret-invalid-key/);
    assert.equal(server.attemptedOutboundAccess, false, server.output);
    assert.deepEqual(await server.stop(), { code: 0, signal: null }, server.output);
  });
}

test('Given valid logging storage settings and denied database network access, when the hosted server serves MCP, then startup needs no database connection and shutdown stays bounded', { timeout: 15_000 }, async (t) => {
  const server = await ServerProcess.start(t, {
    ...hostedFetchSettings, ...workOSSettings,
    DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0',
    DATABASE_URL: 'postgresql://secret-user:secret-password@database.example:5432/postgres',
    LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  });
  assert.equal((await server.request('/.well-known/oauth-protected-resource/mcp')).status, 200);
  assert.equal(await (await server.request('/healthz')).text(), 'ok\n');
  assert.equal((await server.request('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.doesNotMatch(server.output, /Logging storage is unavailable|secret-user|secret-password/);
  assert.equal(server.attemptedOutboundAccess, false, server.output);
  const started = performance.now();
  assert.deepEqual(await server.stop(), { code: 0, signal: null }, server.output);
  assert.ok(performance.now() - started < 2_000, server.output);
});

test('Given a self-hosted server with hosted storage settings, when logging SQL modules cannot load, then MCP starts without loading hosted storage', { timeout: 15_000 }, async (t) => {
  const guard = `data:text/javascript,${encodeURIComponent(`import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'pg' || specifier.includes('logging-storage') || specifier.includes('pg-destination-settings')) throw new Error('Hosted storage module loaded');
  return nextResolve(specifier, context);
} });`)}`;
  const server = await ServerProcess.start(t, withPreload({
    ...selfHostedServerSettings(dataDirectory(t)), LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0',
    DATABASE_URL: 'postgresql://secret-user:secret-password@database.example:5432/postgres',
    LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  }, guard));
  assert.equal((await server.request('/.well-known/oauth-protected-resource/mcp')).status, 200);
  assert.doesNotMatch(server.output, /Hosted storage module loaded|Logging storage/);
  assert.deepEqual(await server.stop(), { code: 0, signal: null }, server.output);
});
