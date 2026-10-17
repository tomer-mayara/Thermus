import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSFakeApi, workosClientFor, type FakeAnswer } from '../../support/doubles/workos/workos-fake-api.ts';

test('Given maxRetries 0 and a bounded timeout, when an organization or membership create gets 500, 429, a dropped connection, or no answer, then the SDK sends one POST and never repeats the write', async (t) => {
  const fake = await WorkOSFakeApi.start(t);
  const workos = workosClientFor(fake, { timeoutMs: 100 });
  const writes = [
    { path: '/organizations', create: () => workos.organizations.createOrganization({ name: 'FS01 fixture', externalId: 'FS01-fixture', metadata: { schema: 'FS01-contract-v1' } }) },
    { path: '/user_management/organization_memberships', create: () => workos.userManagement.createOrganizationMembership({ organizationId: 'org_01ACME', userId: 'user_02BOB', roleSlug: 'user' }) },
  ];
  const failures: readonly FakeAnswer[] = [{ status: 500, body: { message: 'Internal error' } }, { status: 429, body: { message: 'Too many requests' }, headers: { 'Retry-After': '0' } }, 'close', 'hang'];
  for (const { path, create } of writes) {
    for (const failure of failures) {
      fake.answer(`POST ${path}`, failure);
      await assert.rejects(create());
      assert.deepEqual(fake.takeRequests().map(({ method, path: sentPath, idempotencyKey }) => ({ method, path: sentPath, idempotencyKey })), [
        { method: 'POST', path, idempotencyKey: undefined },
      ]);
    }
  }
});
