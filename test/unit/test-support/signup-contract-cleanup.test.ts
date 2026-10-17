import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Organization } from '@workos-inc/node';
import { SignupContractDriver } from '../../support/drivers/workos/signup-contract-driver.ts';

const externalId = 'FS01-cleanup-test';
const organization: Organization = {
  object: 'organization', id: 'org_CLEANUP', name: externalId,
  externalId, metadata: {}, domains: [], allowProfilesOutsideOrganization: false,
  createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z',
};

function statusError(status: number) {
  return Object.assign(new Error(`Provider returned ${status}`), { status });
}

function driverFromTestEnvironment() {
  const saved = { WORKOS_API_KEY: process.env.WORKOS_API_KEY, WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID };
  process.env.WORKOS_API_KEY = 'sk_test_cleanup_unit_test';
  process.env.WORKOS_CLIENT_ID = 'client_01M4VDKB7C7T2GV2NWPS84HADP';
  try {
    return SignupContractDriver.fromEnvironment();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function cleanupDriver(t: TestContext) {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  const driver = driverFromTestEnvironment();
  const organizations = driver.workos.organizations;
  const created = t.mock.method(organizations, 'createOrganization', async () => organization);
  const deleted = t.mock.method(organizations, 'deleteOrganization', async (_id: string) => {});
  const read = t.mock.method(organizations, 'getOrganization', async (_id: string): Promise<Organization> => { throw statusError(404); });
  const lookup = t.mock.method(organizations, 'getOrganizationByExternalId', async () => organization);
  return { driver, created, deleted, read, lookup, advance: (milliseconds: number) => { now += milliseconds; } };
}

test('Given deletion succeeded, when confirmation reads time out and still find the organization, then cleanup waits for an explicit 404 and deletes once', async (t) => {
  const fake = cleanupDriver(t);
  const results = [statusError(408), organization, statusError(408), statusError(404)];
  fake.read.mock.mockImplementation(async (id: string) => {
    assert.equal(id, organization.id);
    const result = results.shift();
    assert.ok(result);
    if (result instanceof Error) throw result;
    return result;
  });

  assert.deepEqual(await fake.driver.cleanup(externalId), [organization.id]);

  assert.equal(fake.read.mock.callCount(), 4);
  assert.deepEqual(fake.deleted.mock.calls.map(({ arguments: args }) => args), [[organization.id]]);
  assert.equal(fake.created.mock.callCount(), 0);
});

test('Given deletion succeeded, when every confirmation read times out, then cleanup fails at the original deadline without another delete', async (t) => {
  const fake = cleanupDriver(t);
  fake.read.mock.mockImplementation(async () => {
    fake.advance(5_000);
    throw statusError(408);
  });

  await assert.rejects(fake.driver.cleanup(externalId), /did not confirm organization deletion within 15 seconds/);

  assert.equal(fake.read.mock.callCount(), 3);
  assert.equal(fake.deleted.mock.callCount(), 1);
  assert.equal(fake.created.mock.callCount(), 0);
});

for (const status of [401, 429, 500]) {
  test(`Given deletion succeeded, when confirmation returns ${status}, then cleanup fails without a read or write retry`, async (t) => {
    const fake = cleanupDriver(t);
    const error = statusError(status);
    fake.read.mock.mockImplementation(async () => { throw error; });

    await assert.rejects(fake.driver.cleanup(externalId), (actual) => actual === error);

    assert.equal(fake.read.mock.callCount(), 1);
    assert.equal(fake.deleted.mock.callCount(), 1);
    assert.equal(fake.created.mock.callCount(), 0);
  });
}

test('Given deletion times out, when cleanup runs, then it fails without retrying the write or confirming absence', async (t) => {
  const fake = cleanupDriver(t);
  const error = statusError(408);
  fake.deleted.mock.mockImplementation(async () => { throw error; });

  await assert.rejects(fake.driver.cleanup(externalId), (actual) => actual === error);

  assert.equal(fake.deleted.mock.callCount(), 1);
  assert.equal(fake.read.mock.callCount(), 0);
});

test('Given creation times out, when concurrent creation runs, then each requested write runs only once', async (t) => {
  const fake = cleanupDriver(t);
  const error = statusError(408);
  fake.created.mock.mockImplementation(async () => { throw error; });

  assert.deepEqual(await fake.driver.createTogether(externalId, {}, 2), [
    { status: 'rejected', reason: error }, { status: 'rejected', reason: error },
  ]);

  assert.equal(fake.created.mock.callCount(), 2);
  assert.equal(fake.deleted.mock.callCount(), 0);
});

test('Given the external ID resolves to an unexpected organization, when cleanup runs, then it refuses deletion', async (t) => {
  const fake = cleanupDriver(t);
  fake.lookup.mock.mockImplementation(async () => ({ ...organization, id: 'org_OTHER', name: 'another run' }));

  await assert.rejects(fake.driver.cleanup(externalId), /cleanup refused an unexpected organization/);

  assert.equal(fake.deleted.mock.callCount(), 0);
  assert.equal(fake.read.mock.callCount(), 0);
});

test('Given recovery lookup times out, when cleanup runs, then it fails without retrying or deleting', async (t) => {
  const fake = cleanupDriver(t);
  const error = statusError(408);
  fake.lookup.mock.mockImplementation(async () => { throw error; });

  await assert.rejects(fake.driver.cleanup(externalId), (actual) => actual === error);

  assert.equal(fake.lookup.mock.callCount(), 1);
  assert.equal(fake.deleted.mock.callCount(), 0);
  assert.equal(fake.read.mock.callCount(), 0);
});
