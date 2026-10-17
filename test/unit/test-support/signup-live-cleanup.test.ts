import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkOS } from '@workos-inc/node';
import { FixtureRegistry } from '../../support/hosted-live/fixture-registry.ts';
import { personalExternalId } from '../../support/hosted-live/signup-fixtures.ts';

function provider() {
  const lookedUp: string[] = [];
  const deleted: string[] = [];
  const records = new Map<string, { id: string; metadata: Record<string, string> }>();
  const workos = {
    organizations: {
      getOrganizationByExternalId: async (externalId: string) => {
        lookedUp.push(externalId);
        const record = records.get(externalId);
        if (record === undefined) throw { status: 404 };
        return record;
      },
      deleteOrganization: async (id: string) => { deleted.push(id); },
    },
    userManagement: { deleteUser: async (id: string) => { deleted.push(id); } },
  } as unknown as WorkOS;
  return { workos, records, lookedUp, deleted };
}

test('Given a recorded test user whose activation response was lost, when fixture cleanup runs, then only that user personal record is recovered and deleted after its user', async () => {
  const fake = provider();
  const externalId = personalExternalId('client_TEST', 'user_OWNED');
  fake.records.set(externalId, { id: 'org_PERSONAL', metadata: { schema: 'thermus-signup-v1', subject: 'user_OWNED' } });
  fake.records.set(personalExternalId('client_TEST', 'user_OTHER'), { id: 'org_OTHER', metadata: { schema: 'thermus-signup-v1', subject: 'user_OTHER' } });
  const registry = new FixtureRegistry(fake.workos, 'client_TEST');
  registry.record('user', 'user_OWNED');

  await registry.deleteAll();
  await registry.deleteAll();

  assert.deepEqual(fake.lookedUp, [externalId]);
  assert.deepEqual(fake.deleted, ['user_OWNED', 'org_PERSONAL']);
});

test('Given a deterministic lookup with another subject record, when fixture cleanup runs, then it refuses deletion', async () => {
  const fake = provider();
  fake.records.set(personalExternalId('client_TEST', 'user_OWNED'), { id: 'org_OTHER', metadata: { schema: 'thermus-signup-v1', subject: 'user_OTHER' } });
  const registry = new FixtureRegistry(fake.workos, 'client_TEST');
  registry.record('user', 'user_OWNED');

  await assert.rejects(registry.deleteAll(), /unexpected acceptance record/);

  assert.deepEqual(fake.deleted, []);
});
