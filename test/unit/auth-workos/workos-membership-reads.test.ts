import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';

const wire = {
  id: 'om_01ALICE', user_id: 'user_01ALICE', organization_id: 'org_01ACME', organization_name: 'Acme', status: 'active',
  updated_at: '2026-10-13T08:00:00.000Z', roles: [{ slug: 'user' }, { slug: 'extra' }],
};

for (const evidence of [false, true, undefined, null, 'false', 0]) {
  test(`Given raw directory management ${String(evidence)}, when the provider membership reader maps one response, then it retains that exact evidence and all role slugs`, async () => {
    const transport = { get: async <Result>() => ({ data: { ...wire, directory_managed: evidence } as Result }) };

    const record = await workosMembershipReads(transport).getOrganizationMembership(wire.id);

    assert.deepEqual(record, { id: wire.id, userId: wire.user_id, organizationId: wire.organization_id, organizationName: wire.organization_name, status: wire.status, updatedAt: wire.updated_at, directoryManaged: evidence, roles: wire.roles });
  });
}

test('Given a list request with filters, cursor, and limit, when the provider reads a page, then one transport GET keeps the exact query, default descending order, and page cursor', async () => {
  const calls: unknown[] = [];
  const transport = { get: async <Result>(...input: unknown[]) => {
    calls.push(input);
    return { data: { data: [wire], list_metadata: { after: 'om_NEXT' } } as Result };
  } };

  const page = await workosMembershipReads(transport).listOrganizationMemberships({ userId: wire.user_id, organizationId: wire.organization_id, statuses: ['active', 'inactive'], after: 'om_BEFORE', limit: 100 });

  assert.deepEqual(calls, [['/user_management/organization_memberships', { query: { user_id: wire.user_id, organization_id: wire.organization_id, statuses: 'active,inactive', limit: 100, before: undefined, after: 'om_BEFORE', order: 'desc' } }]]);
  assert.equal(page.data[0]?.directoryManaged, undefined);
  assert.equal(page.listMetadata.after, 'om_NEXT');
});

test('Given a membership ID with reserved characters, when the provider reads it, then the transport receives one encoded path segment', async () => {
  const calls: string[] = [];
  const transport = { get: async <Result>(path: string) => { calls.push(path); return { data: wire as Result }; } };

  await workosMembershipReads(transport).getOrganizationMembership('om_example:/?#');

  assert.deepEqual(calls, ['/user_management/organization_memberships/om_example:%2F%3F%23']);
});

for (const id of ['.', '..']) {
  test(`Given the invalid membership path segment ${id}, when the provider reads it, then it fails before any transport request`, async () => {
    let calls = 0;
    const transport = { get: async <Result>() => { calls++; return { data: wire as Result }; } };

    await assert.rejects(workosMembershipReads(transport).getOrganizationMembership(id), TypeError);

    assert.equal(calls, 0);
  });
}
