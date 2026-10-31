import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';

type Rows = Record<string, unknown>[];

const nextRow = /^SELECT organization_id, state, service_name, render_service_id FROM thermus_admin\.tenants\s+WHERE state IN \('requested', 'creating', 'deploying'\)\s+AND \(claimed_by IS NULL OR claimed_by = \$1 OR claimed_until <= now\(\)\)\s+AND \(state <> 'deploying' OR internal_url IS NULL OR updated_at <= now\(\) - interval '15 seconds'\)\s+ORDER BY state = 'requested', updated_at, organization_id\s+LIMIT 1 FOR UPDATE SKIP LOCKED$/;
const claimRequested = /^UPDATE thermus_admin\.tenants SET state = 'creating', service_name = \$2, plan = \$3, claimed_by = \$4,\s+claimed_until = now\(\) \+ interval '60 seconds', updated_at = now\(\) WHERE organization_id = \$1 AND state = 'requested'$/;
const claimResumed = /^UPDATE thermus_admin\.tenants SET service_name = COALESCE\(service_name, \$2\), claimed_by = \$3,\s+claimed_until = now\(\) \+ interval '60 seconds' WHERE organization_id = \$1$/;
const renewClaim = /^UPDATE thermus_admin\.tenants SET claimed_until = now\(\) \+ interval '60 seconds'\s+WHERE organization_id = \$1 AND claimed_by = \$2 AND state IN \('creating', 'deploying'\) RETURNING organization_id$/;
const releaseClaim = /^UPDATE thermus_admin\.tenants SET claimed_by = NULL, claimed_until = NULL\s+WHERE organization_id = \$1 AND claimed_by = \$2 AND state <> 'creating'$/;
const releaseUnworkedClaim = /^UPDATE thermus_admin\.tenants SET claimed_by = NULL, claimed_until = NULL WHERE organization_id = \$1 AND claimed_by = \$2$/;
const recordService = /^UPDATE thermus_admin\.tenants SET state = 'deploying', render_service_id = \$2, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'creating' AND claimed_by = \$3 RETURNING organization_id$/;
const recordLive = /^UPDATE thermus_admin\.tenants SET state = 'live', internal_url = \$3, image_digest = COALESCE\(\$4::text, image_digest\), applied_plan = plan,\s+failure_reason = NULL, claimed_by = NULL, claimed_until = NULL, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'deploying' AND render_service_id = \$2 AND \(claimed_by = \$5 OR \$5::text IS NULL\) RETURNING organization_id$/;
const recordFailed = /^UPDATE thermus_admin\.tenants SET state = 'failed', failure_reason = \$2, claimed_by = NULL, claimed_until = NULL, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state IN \('creating', 'deploying'\) AND render_service_id IS NOT DISTINCT FROM \$3 AND claimed_by = \$4 RETURNING organization_id$/;
const ownsService = 'SELECT 1 AS owned FROM thermus_admin.tenants WHERE render_service_id = $1';
const holder = 'holder-1';
const claim = { serviceNameOf: (organizationId: string) => `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`, plan: '0.5c-512mb', holder };
const rowA = { organizationId: 'org_01A', state: 'deploying', serviceName: 'thermus-tenant-org-01a', serviceId: 'srv-a', holder } as const;

function provisioningStore(t: TestContext, answer: (text: string) => Rows | Error) {
  const queries: { readonly text: string; readonly values?: unknown[] }[] = [];
  const releases: boolean[] = [];
  const runtime = new BoundedSqlRuntime({
    connect: async () => ({
      query: async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        const rows = answer(text);
        if (rows instanceof Error) throw rows;
        return { rows };
      },
      release: (destroy?: boolean) => { releases.push(Boolean(destroy)); },
    }),
    end: async () => {}, on: () => {},
  });
  t.after(() => runtime.close());
  return { store: new PgTenantProvisioningStore(runtime), queries, releases, texts: () => queries.map(({ text }) => text) };
}

function nextRowIs(row: Record<string, unknown> | undefined): (text: string) => Rows {
  return (text) => nextRow.test(text) && row !== undefined ? [row] : [];
}

test('Given no row to work on, when the next row is claimed, then one transaction selects with SKIP LOCKED a row without a live claim of another holder, changes nothing, and gives idle', async (t) => {
  const { store, queries, texts, releases } = provisioningStore(t, nextRowIs(undefined));
  assert.deepEqual(await store.claimNext(claim), { status: 'idle' });
  assert.equal(texts().length, 3);
  assert.equal(texts()[0], 'BEGIN');
  assert.match(texts()[1] ?? '', nextRow);
  assert.deepEqual(queries[1]?.values, [holder]);
  assert.equal(texts()[2], 'COMMIT');
  assert.deepEqual(releases, [false]);
});

test('Given the oldest requested row, when it is claimed, then it moves to creating with its service name, the free plan, and a claim of the holder for 60 s in the same transaction', async (t) => {
  const { store, queries, texts } = provisioningStore(t, nextRowIs({ organization_id: 'org_01A', state: 'requested', service_name: 'a stale name', render_service_id: null }));
  assert.deepEqual(await store.claimNext(claim), {
    status: 'claimed', resumed: false, row: { organizationId: 'org_01A', state: 'creating', serviceName: 'thermus-tenant-org-01a', serviceId: null, holder },
  });
  assert.match(texts()[2] ?? '', claimRequested);
  assert.deepEqual(queries[2]?.values, ['org_01A', 'thermus-tenant-org-01a', '0.5c-512mb', holder]);
  assert.equal(texts()[3], 'COMMIT');
});

test('Given a creating or deploying row of an earlier run, when the next row is claimed, then it is resumed with its own name and service ID and held for the holder for 60 s', async (t) => {
  const deploying = provisioningStore(t, nextRowIs({ organization_id: 'org_01B', state: 'deploying', service_name: 'thermus-spike-tenant-org_01b', render_service_id: 'srv-b' }));
  assert.deepEqual(await deploying.store.claimNext(claim), {
    status: 'claimed', resumed: true, row: { organizationId: 'org_01B', state: 'deploying', serviceName: 'thermus-spike-tenant-org_01b', serviceId: 'srv-b', holder },
  });
  assert.match(deploying.texts()[2] ?? '', claimResumed);
  assert.deepEqual(deploying.queries[2]?.values, ['org_01B', 'thermus-spike-tenant-org_01b', holder], 'The update keeps the stored name');
  const unnamed = provisioningStore(t, nextRowIs({ organization_id: 'org_01C', state: 'creating', service_name: null, render_service_id: null }));
  assert.deepEqual(await unnamed.store.claimNext(claim), {
    status: 'claimed', resumed: true, row: { organizationId: 'org_01C', state: 'creating', serviceName: 'thermus-tenant-org-01c', serviceId: null, holder },
  });
  assert.match(unnamed.texts()[2] ?? '', claimResumed);
  assert.deepEqual(unnamed.queries[2]?.values, ['org_01C', 'thermus-tenant-org-01c', holder]);
});

test('Given a failure in the claim, when the next row is claimed, then the result is unavailable and the client is destroyed', async (t) => {
  const beforeUpdate = provisioningStore(t, (text) => nextRow.test(text) ? new Error('private storage details') : []);
  assert.deepEqual(await beforeUpdate.store.claimNext(claim), { status: 'unavailable' });
  assert.deepEqual(beforeUpdate.releases, [true]);
  const atCommit = provisioningStore(t, (text) => text === 'COMMIT' ? new Error('private commit details') : nextRowIs({ organization_id: 'org_01A', state: 'requested', service_name: null, render_service_id: null })(text));
  assert.deepEqual(await atCommit.store.claimNext(claim), { status: 'unavailable' });
  assert.deepEqual(atCommit.releases, [true]);
});

test('Given a row in work, when the holder renews its claim, then one guarded update holds it 60 s more, and a row of another holder or out of work is moved', async (t) => {
  const renewed = provisioningStore(t, (text) => renewClaim.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await renewed.store.renewClaim(rowA), { status: 'recorded' });
  assert.deepEqual(renewed.queries.map(({ values }) => values), [['org_01A', holder]]);
  const lost = provisioningStore(t, () => []);
  assert.deepEqual(await lost.store.renewClaim(rowA), { status: 'moved' });
  const failed = provisioningStore(t, () => new Error('private storage details'));
  assert.deepEqual(await failed.store.renewClaim(rowA), { status: 'unavailable' });
});

test('Given the end of the work on a row, when the holder releases its claim, then one guarded update frees the row unless it is creating, and a failed write is ignored', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => releaseClaim.test(text) ? [] : new Error('unexpected statement'));
  await store.releaseClaim(rowA);
  assert.deepEqual(queries.map(({ values }) => values), [['org_01A', holder]]);
  const failed = provisioningStore(t, () => new Error('private storage details'));
  await failed.store.releaseClaim(rowA);
  assert.equal(failed.queries.length, 1);
});

test('Given a claim that the loop does not work on, when the holder releases it, then one guarded update frees the row in each state', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => releaseUnworkedClaim.test(text) ? [] : new Error('unexpected statement'));
  await store.releaseUnworkedClaim({ ...rowA, state: 'creating', serviceId: null });
  assert.deepEqual(queries.map(({ values }) => values), [['org_01A', holder]]);
  const failed = provisioningStore(t, () => new Error('private storage details'));
  await failed.store.releaseUnworkedClaim(rowA);
  assert.equal(failed.queries.length, 1);
});

test('Given a creating row, when the service is recorded, then one guarded update of the holder moves it to deploying with the service ID', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordService.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordService({ ...rowA, state: 'creating', serviceId: null }, 'srv-a'), { status: 'recorded' });
  assert.deepEqual(queries.map(({ values }) => values), [['org_01A', 'srv-a', holder]]);
});

test('Given a deploying row on the service of the work, when live is recorded, then one guarded update of the holder names that service, sets the internal address, the digest when known, and the applied plan, and frees the claim', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordLive.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordLive(rowA, 'srv-a', { internalUrl: 'http://thermus-tenant-org-01a:8080', imageDigest: `sha256:${'a'.repeat(64)}` }), { status: 'recorded' });
  assert.deepEqual(await store.recordLive(rowA, 'srv-a', { internalUrl: 'http://thermus-tenant-org-01a:8080' }), { status: 'recorded' });
  assert.deepEqual(await store.recordLive({ organizationId: 'org_01A', holder: null }, 'srv-a', { internalUrl: 'http://thermus-tenant-org-01a:8080' }), { status: 'recorded' });
  assert.deepEqual(queries.map(({ values }) => values), [
    ['org_01A', 'srv-a', 'http://thermus-tenant-org-01a:8080', `sha256:${'a'.repeat(64)}`, holder],
    ['org_01A', 'srv-a', 'http://thermus-tenant-org-01a:8080', null, holder],
    ['org_01A', 'srv-a', 'http://thermus-tenant-org-01a:8080', null, null],
  ], 'The fleet resume names no holder');
});

test('Given a row in creating or deploying, when a failure is recorded, then one guarded update of the holder names the service of the work, sets failed with the reason, bounded to 1000 characters, and frees the claim', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordFailed.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordFailed(rowA, 'srv-a', 'The deploy dep-1 of srv-a ended as update_failed'), { status: 'recorded' });
  await store.recordFailed(rowA, null, 'x'.repeat(1_500));
  assert.deepEqual(queries[0]?.values, ['org_01A', 'The deploy dep-1 of srv-a ended as update_failed', 'srv-a', holder]);
  assert.equal((queries[1]?.values?.[1] as string).length, 1_000);
  assert.equal(queries[1]?.values?.[2], null, 'A row without a service binds to no service');
});

test('Given a row in another state or of another holder, when a change is recorded, then nothing changes and the result says that the row moved', async (t) => {
  const { store } = provisioningStore(t, () => []);
  assert.deepEqual(await store.recordService(rowA, 'srv-a'), { status: 'moved' });
  assert.deepEqual(await store.recordLive(rowA, 'srv-a', { internalUrl: 'http://a:8080' }), { status: 'moved' });
  assert.deepEqual(await store.recordFailed(rowA, 'srv-a', 'reason'), { status: 'moved' });
});

test('Given a failed write, when a change is recorded, then the result is unavailable', async (t) => {
  const { store } = provisioningStore(t, () => new Error('private storage details'));
  assert.deepEqual(await store.recordService(rowA, 'srv-a'), { status: 'unavailable' });
  assert.deepEqual(await store.recordLive(rowA, 'srv-a', { internalUrl: 'http://a:8080' }), { status: 'unavailable' });
  assert.deepEqual(await store.recordFailed(rowA, 'srv-a', 'reason'), { status: 'unavailable' });
});

test('Given the registry, when the write guard asks for a service ID, then a row with that ID owns it and a failed read owns nothing', async (t) => {
  const owned = provisioningStore(t, (text) => text === ownsService ? [{ owned: 1 }] : []);
  assert.equal(await owned.store.ownsService('srv-a'), true);
  assert.deepEqual(owned.queries, [{ text: ownsService, values: ['srv-a'] }]);
  const unknown = provisioningStore(t, () => []);
  assert.equal(await unknown.store.ownsService('srv-other'), false);
  const failed = provisioningStore(t, () => new Error('private storage details'));
  assert.equal(await failed.store.ownsService('srv-a'), false);
});
