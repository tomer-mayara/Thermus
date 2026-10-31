import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantProvisioningStore } from '../../../src/tenancy/tenants/pg-tenant-provisioning-store.ts';

type Rows = Record<string, unknown>[];

const nextRow = /^SELECT organization_id, state, service_name, render_service_id FROM thermus_admin\.tenants\s+WHERE state IN \('requested', 'creating', 'deploying'\)\s+AND \(state <> 'deploying' OR internal_url IS NULL OR updated_at <= now\(\) - interval '15 seconds'\)\s+ORDER BY state = 'requested', updated_at, organization_id\s+LIMIT 1 FOR UPDATE SKIP LOCKED$/;
const claimRequested = /^UPDATE thermus_admin\.tenants SET state = 'creating', service_name = \$2, plan = \$3, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'requested'$/;
const nameResumed = /^UPDATE thermus_admin\.tenants SET service_name = \$2 WHERE organization_id = \$1 AND service_name IS NULL$/;
const recordService = /^UPDATE thermus_admin\.tenants SET state = 'deploying', render_service_id = \$2, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'creating' RETURNING organization_id$/;
const recordLive = /^UPDATE thermus_admin\.tenants SET state = 'live', internal_url = \$3, image_digest = COALESCE\(\$4::text, image_digest\), applied_plan = plan,\s+failure_reason = NULL, updated_at = now\(\) WHERE organization_id = \$1 AND state = 'deploying' AND render_service_id = \$2 RETURNING organization_id$/;
const recordFailed = /^UPDATE thermus_admin\.tenants SET state = 'failed', failure_reason = \$2, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state IN \('creating', 'deploying'\) AND render_service_id IS NOT DISTINCT FROM \$3 RETURNING organization_id$/;
const ownsService = 'SELECT 1 AS owned FROM thermus_admin.tenants WHERE render_service_id = $1';
const claim = { serviceNameOf: (organizationId: string) => `thermus-tenant-${organizationId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`, plan: '0.5c-512mb' };

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

test('Given no row to work on, when the next row is claimed, then one transaction selects with SKIP LOCKED, changes nothing, and gives idle', async (t) => {
  const { store, texts, releases } = provisioningStore(t, nextRowIs(undefined));
  assert.deepEqual(await store.claimNext(claim), { status: 'idle' });
  assert.equal(texts().length, 3);
  assert.equal(texts()[0], 'BEGIN');
  assert.match(texts()[1] ?? '', nextRow);
  assert.equal(texts()[2], 'COMMIT');
  assert.deepEqual(releases, [false]);
});

test('Given the oldest requested row, when it is claimed, then it moves to creating with its service name and the free plan in the same transaction', async (t) => {
  const { store, queries, texts } = provisioningStore(t, nextRowIs({ organization_id: 'org_01A', state: 'requested', service_name: 'a stale name', render_service_id: null }));
  assert.deepEqual(await store.claimNext(claim), {
    status: 'claimed', resumed: false, row: { organizationId: 'org_01A', state: 'creating', serviceName: 'thermus-tenant-org-01a', serviceId: null },
  });
  assert.match(texts()[2] ?? '', claimRequested);
  assert.deepEqual(queries[2]?.values, ['org_01A', 'thermus-tenant-org-01a', '0.5c-512mb']);
  assert.equal(texts()[3], 'COMMIT');
});

test('Given a creating or deploying row of an earlier run, when the next row is claimed, then it is resumed with its own name and service ID', async (t) => {
  const deploying = provisioningStore(t, nextRowIs({ organization_id: 'org_01B', state: 'deploying', service_name: 'thermus-spike-tenant-org_01b', render_service_id: 'srv-b' }));
  assert.deepEqual(await deploying.store.claimNext(claim), {
    status: 'claimed', resumed: true, row: { organizationId: 'org_01B', state: 'deploying', serviceName: 'thermus-spike-tenant-org_01b', serviceId: 'srv-b' },
  });
  assert.deepEqual(deploying.texts().filter((text) => text.startsWith('UPDATE')), []);
  const unnamed = provisioningStore(t, nextRowIs({ organization_id: 'org_01C', state: 'creating', service_name: null, render_service_id: null }));
  assert.deepEqual(await unnamed.store.claimNext(claim), {
    status: 'claimed', resumed: true, row: { organizationId: 'org_01C', state: 'creating', serviceName: 'thermus-tenant-org-01c', serviceId: null },
  });
  assert.match(unnamed.texts()[2] ?? '', nameResumed);
  assert.deepEqual(unnamed.queries[2]?.values, ['org_01C', 'thermus-tenant-org-01c']);
});

test('Given a failure in the claim, when the next row is claimed, then the result is unavailable and the client is destroyed', async (t) => {
  const beforeUpdate = provisioningStore(t, (text) => nextRow.test(text) ? new Error('private storage details') : []);
  assert.deepEqual(await beforeUpdate.store.claimNext(claim), { status: 'unavailable' });
  assert.deepEqual(beforeUpdate.releases, [true]);
  const atCommit = provisioningStore(t, (text) => text === 'COMMIT' ? new Error('private commit details') : nextRowIs({ organization_id: 'org_01A', state: 'requested', service_name: null, render_service_id: null })(text));
  assert.deepEqual(await atCommit.store.claimNext(claim), { status: 'unavailable' });
  assert.deepEqual(atCommit.releases, [true]);
});

test('Given a creating row, when the service is recorded, then one guarded update moves it to deploying with the service ID', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordService.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordService('org_01A', 'srv-a'), { status: 'recorded' });
  assert.deepEqual(queries.map(({ values }) => values), [['org_01A', 'srv-a']]);
});

test('Given a deploying row on the service of the work, when live is recorded, then one guarded update names that service and sets the internal address, the digest when known, and the applied plan', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordLive.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordLive('org_01A', 'srv-a', { internalUrl: 'http://thermus-tenant-org-01a:8080', imageDigest: `sha256:${'a'.repeat(64)}` }), { status: 'recorded' });
  assert.deepEqual(await store.recordLive('org_01A', 'srv-a', { internalUrl: 'http://thermus-tenant-org-01a:8080' }), { status: 'recorded' });
  assert.deepEqual(queries.map(({ values }) => values), [
    ['org_01A', 'srv-a', 'http://thermus-tenant-org-01a:8080', `sha256:${'a'.repeat(64)}`],
    ['org_01A', 'srv-a', 'http://thermus-tenant-org-01a:8080', null],
  ]);
});

test('Given a row in creating or deploying, when a failure is recorded, then one guarded update names the service of the work and sets failed with the reason, bounded to 1000 characters', async (t) => {
  const { store, queries } = provisioningStore(t, (text) => recordFailed.test(text) ? [{ organization_id: 'org_01A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordFailed('org_01A', 'srv-a', 'The deploy dep-1 of srv-a ended as update_failed'), { status: 'recorded' });
  await store.recordFailed('org_01A', null, 'x'.repeat(1_500));
  assert.deepEqual(queries[0]?.values, ['org_01A', 'The deploy dep-1 of srv-a ended as update_failed', 'srv-a']);
  assert.equal((queries[1]?.values?.[1] as string).length, 1_000);
  assert.equal(queries[1]?.values?.[2], null, 'A row without a service binds to no service');
});

test('Given a row in another state, when a change is recorded, then nothing changes and the result says that the row moved', async (t) => {
  const { store } = provisioningStore(t, () => []);
  assert.deepEqual(await store.recordService('org_01A', 'srv-a'), { status: 'moved' });
  assert.deepEqual(await store.recordLive('org_01A', 'srv-a', { internalUrl: 'http://a:8080' }), { status: 'moved' });
  assert.deepEqual(await store.recordFailed('org_01A', 'srv-a', 'reason'), { status: 'moved' });
});

test('Given a failed write, when a change is recorded, then the result is unavailable', async (t) => {
  const { store } = provisioningStore(t, () => new Error('private storage details'));
  assert.deepEqual(await store.recordService('org_01A', 'srv-a'), { status: 'unavailable' });
  assert.deepEqual(await store.recordLive('org_01A', 'srv-a', { internalUrl: 'http://a:8080' }), { status: 'unavailable' });
  assert.deepEqual(await store.recordFailed('org_01A', 'srv-a', 'reason'), { status: 'unavailable' });
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
