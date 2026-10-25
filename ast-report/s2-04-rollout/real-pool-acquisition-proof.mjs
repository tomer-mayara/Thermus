import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const root = process.cwd();
const load = (path) => import(pathToFileURL(resolve(root, path)).href);
const output = new URL('./real-pool-acquisition-proof.json', import.meta.url);
const report = { at: new Date().toISOString(), scope: 'Actual Supabase restricted pool; isolated local hosted composition; no deployed outage', controls: { poolMax: 1, heldIdleClient: true, transactions: false, locks: false, rowMutations: false, migrations: false, providerWrites: false, renderChanges: false, identity: 'loopback WorkOSFake', toolOperation: 'fixed harmless fetch result', mcp: 'real hosted composition and SDK', portal: 'existing production portal build' } };
const cleanups = [];
const abort = new AbortController();
const deadline = setTimeout(() => abort.abort(), 25_000);
const context = { after: (fn) => cleanups.push(fn), signal: abort.signal };
let phase = 'input compatibility';
let pool, held, runtime, application, client, encryptionKey;
let completed = false;
try {
  const coverage = JSON.parse(await readFile(resolve(root, 'ast-report/coverage.json'), 'utf8'));
  const { assertBuild } = await load('script/code-quality/coverage/build.ts');
  const { sourceFingerprintOf } = await load('script/code-quality/provenance/inputs.ts');
  if (sourceFingerprintOf(root) !== coverage.provenance.sourceFingerprint || `node-${process.versions.node}` !== coverage.provenance.runtime) throw new Error('source/runtime compatibility');
  assertBuild(root, coverage.provenance.buildFingerprint);
  report.provenance = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), coverageCaptureCommit: coverage.commit, sourceFingerprint: coverage.provenance.sourceFingerprint, broadInputsMatch: false, broadInputsMismatchCause: 'Not attributed; no secret-file hashes retained or published', coverageReuseClaim: false, buildFingerprint: coverage.provenance.buildFingerprint, sourceAndDistCompatible: true, runtime: process.version };
  phase = 'protected configuration';
  const environment = parseEnv(await readFile(resolve(root, '.env.local'), 'utf8'));
  const { loadLoggingStorageConfig } = await load('dist/src/runtime/config/logging-storage-config.js');
  const config = await loadLoggingStorageConfig(environment);
  if (config.status !== 'available' || !config.ca) throw new Error('configuration');
  encryptionKey = config.encryptionKey;
  const url = new URL(config.connectionString);
  if (url.hostname !== 'aws-1-us-west-2.pooler.supabase.com' || !decodeURIComponent(url.username).endsWith('.rnqktgtgrvvqptbaosth')) throw new Error('selected project');
  pool = new Pool({ host: url.hostname, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), port: Number(url.port || 5432), sslnegotiation: 'postgres', options: ' ', client_encoding: 'UTF8', ssl: { rejectUnauthorized: true, ca: config.ca }, max: 1, connectionTimeoutMillis: 1000, idleTimeoutMillis: 1000, statement_timeout: 1500, query_timeout: 2000, application_name: `thermus-acquisition-proof-${randomUUID()}` });
  let acquired = 0;
  pool.on('acquire', () => acquired++);
  phase = 'verified connection and role';
  held = await pool.connect();
  const tls = held.connection.stream;
  if (!tls.encrypted || tls.authorized !== true) throw new Error('TLS');
  const { rows: [role] } = await held.query("SELECT current_user AS role, has_schema_privilege(current_user,'thermus_admin','USAGE') AS usage, has_schema_privilege(current_user,'thermus_admin','CREATE') AS ddl, has_table_privilege(current_user,'thermus_admin.logging_destination_settings','SELECT') AS can_select, has_table_privilege(current_user,'thermus_admin.logging_destination_settings','INSERT') AS can_insert, has_table_privilege(current_user,'thermus_admin.logging_destination_settings','UPDATE') AS can_update, has_table_privilege(current_user,'thermus_admin.logging_destination_settings','DELETE') AS can_delete");
  if (role.role !== 'thermus_logging' || !role.usage || !role.can_select || !role.can_insert || !role.can_update || role.ddl || role.can_delete) throw new Error('role');
  report.connection = { selectedProjectMatches: true, clientToPoolerEncrypted: true, authorized: true, hostnameVerification: 'default Node verification enabled', tlsProtocol: tls.getProtocol(), officialCaSha256: createHash('sha256').update(config.ca).digest('hex'), restrictedRole: role.role, grants: { schemaUsage: role.usage, select: role.can_select, insert: role.can_insert, update: role.can_update, delete: role.can_delete, schemaCreate: role.ddl }, preflightReadOnlyQueries: 1 };
  const { BoundedSqlRuntime } = await load('dist/src/logs/audit/bounded-sql-runtime.js');
  const { PgDestinationSettingsStore } = await load('dist/src/logs/audit/pg-destination-settings-store.js');
  runtime = new BoundedSqlRuntime(pool, { active: 2, pending: 2, acquisitionMs: 1000, operationMs: 2000, statementMs: 1500, idleMs: 1000, closeMs: 1500 });
  const store = new PgDestinationSettingsStore(runtime);
  phase = 'isolated hosted composition';
  const { WorkOSFake } = await load('dist/test/support/doubles/workos/workos-fake.js');
  const { hostedRootConfig } = await load('dist/test/support/fixtures/hosted-config.js');
  const { composeWorkOSApplication } = await load('dist/src/app/hosted-workos-application.js');
  const { HostedPortal } = await load('dist/src/app/hosted-portal.js');
  const world = await WorkOSFake.start(context, hostedRootConfig.publicBaseUrl, ['org_LOCAL_ACQUISITION']);
  const user = { id: 'user_LOCAL_ACQUISITION', email: 'local-proof@example.invalid', firstName: 'Local proof' };
  world.users = [user];
  world.memberships = [{ userId: user.id, organizationId: 'org_LOCAL_ACQUISITION', roles: ['user'] }];
  const text = 'Local controlled MCP result while actual settings pool acquisition is unavailable.';
  const logger = { info() {}, error() {} };
  const portal = await HostedPortal.load(['https://api.workos.com', world.settings.authkitIssuer]);
  application = portal.withApplication(await composeWorkOSApplication(hostedRootConfig, world.connection(), { logger, loggingStorage: { store, close: () => runtime.close() }, toolOperations: { fetch: async () => text, search: async () => ({ status: 'released', markdown: text }) } }));
  const token = await world.connectToken(user, { org_id: 'org_LOCAL_ACQUISITION' });
  client = new Client({ name: 'thermus-isolated-acquisition-proof', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(hostedRootConfig.mcpResourceUrl), { authProvider: { token: async () => token }, fetch: async (input, init) => application.handle(new Request(input, init)) }), { signal: abort.signal, timeout: 5000 });
  phase = 'bounded acquisition and admitted MCP';
  let settled = false;
  const start = performance.now();
  const reading = store.read(`local-acquisition-proof:${randomUUID()}`).finally(() => { settled = true; });
  await delay(20);
  if (pool.waitingCount !== 1 || settled) throw new Error('pending acquisition');
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: 'https://example.invalid/local-controlled', reason: 'Read while the actual private pool has no available client' } });
  const mcpMs = performance.now() - start;
  const mcpWhilePending = !settled && pool.waitingCount >= 1;
  const health = await application.handle(new Request(new URL('healthz', hostedRootConfig.publicBaseUrl)));
  const healthBody = await health.text();
  const healthWhilePending = !settled && pool.waitingCount >= 1;
  if (result.isError === true || JSON.stringify(result.content) !== JSON.stringify([{ type: 'text', text }]) || !mcpWhilePending || health.status !== 200 || healthBody !== 'ok\n' || !healthWhilePending) throw new Error('nonblocking outcome');
  const unavailable = await reading;
  const elapsedMs = performance.now() - start;
  if (unavailable.status !== 'unavailable' || elapsedMs >= 1900 || acquired !== 1) throw new Error('acquisition bound');
  await delay(200);
  report.acquisition = { runtimeActive: 2, poolMax: 1, acquisitionMs: 1000, operationMs: 2000, pendingAcquisitionObserved: true, readResult: unavailable.status, elapsedMs: Math.round(elapsedMs), acquireEventsBeforeCleanup: acquired, heldClientStillOwned: true, storeClientAcquired: false, storeQueryCouldStart: false, pendingAfterTimeouts: pool.waitingCount };
  report.mcp = { tool: 'getURLAsMarkdown', completeExpectedResult: true, elapsedMs: Math.round(mcpMs), completedWhileActualStorePending: mcpWhilePending, healthStatus: health.status, healthBodyMatches: true, healthWhileActualStorePending: healthWhilePending, sameStoreInProductionComposition: true, liveWorkosClaim: false, liveRendererClaim: false, deployedOutageClaim: false };
  completed = true;
} catch {
  report.failure = { phase, sanitized: true, message: 'The probe did not complete its stated checks. No raw driver/provider error was retained.' };
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  encryptionKey?.fill(0);
  const cleanup = [];
  if (held) { try { held.release(); cleanup.push({ resource: 'held idle client', closed: true }); } catch { cleanup.push({ resource: 'held idle client', closed: false }); } }
  for (const [name, close] of [['MCP client', () => client?.close()], ['application', () => application?.close()], ['SQL runtime', () => runtime?.close()], ['pool', () => pool?.end()]]) {
    try { if (name !== 'pool' || !runtime) await close(); cleanup.push({ resource: name, closed: true }); } catch { cleanup.push({ resource: name, closed: false }); }
  }
  for (const close of cleanups.reverse()) { try { await close(); cleanup.push({ resource: 'loopback fake', closed: true }); } catch { cleanup.push({ resource: 'loopback fake', closed: false }); } }
  report.cleanup = { resources: cleanup, poolTotal: pool?.totalCount ?? 0, poolIdle: pool?.idleCount ?? 0, poolWaiting: pool?.waitingCount ?? 0 };
  report.status = completed && cleanup.every(item => item.closed) && report.cleanup.poolTotal === 0 && report.cleanup.poolWaiting === 0 ? 'passed' : 'failed';
  if (report.status !== 'passed') process.exitCode = 1;
  report.finishedAt = new Date().toISOString();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, failurePhase: report.failure?.phase, acquisition: report.acquisition, mcp: report.mcp, cleanup: report.cleanup }));
}
