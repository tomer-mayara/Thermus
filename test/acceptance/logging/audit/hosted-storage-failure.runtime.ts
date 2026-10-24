import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import '../../../support/processes/use-hosted-portal-fixture.ts';
import { HostedPortal } from '../../../../src/app/hosted-portal.ts';
import { createHostedToolOperations, fetchToolServers } from '../../../../src/app/fetch-tool.ts';
import { createPgSettingsRuntime } from '../../../../src/logs/audit/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import { WorkOSFake } from '../../../support/doubles/workos/workos-fake.ts';
import { RendererProcessDouble } from '../../../support/doubles/website-fetcher/renderer-process-double.ts';
import { connectMcpClient } from '../../../support/drivers/mcp/mcp-sdk-client.ts';
import { hostedRootConfig } from '../../../support/fixtures/hosted-config.ts';
import { hostedFetchSettings } from '../../../support/fixtures/hosted-placeholder.ts';
import { composeApplicationWithWorkOSFake } from '../../../support/in-process/workos-site.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';

test('Given current WorkOS access and a settings read blocked by PostgreSQL, when an admitted client calls MCP, then the tool and health check succeed while storage times out and active storage closes within the shared shutdown deadline', { timeout: 30_000 }, async (t) => {
  const sql = await postgresSettingsSite(t);
  const holder = createPgSettingsRuntime({ ...sql.connection, bounds: { operationMs: 10_000 } });
  const runtime = createPgSettingsRuntime({ ...sql.connection, bounds: { operationMs: 1_000, statementMs: 5_000 } });
  const store = new PgDestinationSettingsStore(runtime);
  const release = Promise.withResolvers<void>();
  const locked = Promise.withResolvers<void>();
  t.after(async () => { release.resolve(); await Promise.all([holder.close(), runtime.close()]); });
  const user = { id: 'user_storage', email: 'storage@example.com', firstName: 'Storage' };
  const world = await WorkOSFake.start(t, hostedRootConfig.publicBaseUrl, ['org_storage']);
  world.users = [user];
  world.memberships = [{ userId: user.id, organizationId: 'org_storage', roles: ['user'] }];
  const logger = { info: (_message: string) => {}, error: (_message: string) => {} };
  const portal = await HostedPortal.load(['https://api.workos.com', world.settings.authkitIssuer]);
  const application = portal.withApplication(await composeApplicationWithWorkOSFake(hostedRootConfig, world, {
    logger, buildServer: fetchToolServers(createHostedToolOperations(hostedFetchSettings, logger), logger),
    loggingStorage: { store, close: () => runtime.close() },
  }));
  t.after(() => application.close());
  const token = await world.connectToken(user, { org_id: 'org_storage' });
  const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL(hostedRootConfig.mcpResourceUrl), {
    authProvider: { token: async () => token }, fetch: async (input, init) => application.handle(new Request(input, init)),
  }));
  t.after(() => client.close());
  const url = 'https://source.example/storage-failure';
  const text = 'The admitted product request still returns this rendered article while private settings storage waits.';
  RendererProcessDouble.install(t).serve(url, { finalUrl: url, html: `<html><body><main><p>${text}</p></main></body></html>` });
  const holding = holder.run(async (session) => {
    await session.query('BEGIN');
    await session.query('LOCK TABLE thermus_admin.logging_destination_settings IN ACCESS EXCLUSIVE MODE');
    locked.resolve();
    await release.promise;
    await session.query('ROLLBACK');
  });
  await locked.promise;
  const started = performance.now();
  let storageSettled = false;
  const reading = store.read('workos:client_placeholder:org_storage').finally(() => { storageSettled = true; });
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: 'Read while settings storage is unavailable' } });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.content, [{ type: 'text', text }]);
  assert.equal(storageSettled, false, 'MCP completed while the real SQL settings read remained blocked.');
  assert.equal(await (await application.handle(new Request('https://thermus.example/healthz'))).text(), 'ok\n');
  assert.deepEqual(await reading, { status: 'unavailable' });
  assert.ok(performance.now() - started < 2_000);
  const active = store.read('workos:client_placeholder:org_storage');
  await delay(50);
  const closing = performance.now();
  await application.close();
  assert.ok(performance.now() - closing < 10_000, 'Active SQL cleanup fits the existing shared shutdown deadline.');
  assert.deepEqual(await active, { status: 'unavailable' });
  release.resolve();
  await holding;
});
