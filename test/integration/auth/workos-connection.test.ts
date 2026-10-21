import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openWorkOSConnection } from '../../../src/app/hosted-workos-application.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';

const logger = { info() {}, error() {} };

test('Given the production WorkOS connection, when organization and membership writes get a server error, then each sends one POST with no retry', async (t) => {
  const requests: { path: string; method: string | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ path: new URL(input instanceof Request ? input.url : input).pathname, method: init?.method });
    return Response.json({ message: 'Fixture failure' }, { status: 500, headers: { 'Retry-After': '0' } });
  });
  const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));

  await assert.rejects(workos.organizations.createOrganization({ name: 'FS01 fixture', externalId: 'FS01-fixture' }), { status: 500 });
  await assert.rejects(workos.userManagement.createOrganizationMembership({ organizationId: 'org_01ACME', userId: 'user_01ADA', roleSlug: 'user' }), { status: 500 });

  assert.deepEqual(requests, [{ path: '/organizations', method: 'POST' }, { path: '/user_management/organization_memberships', method: 'POST' }]);
});

test('Given the production WorkOS connection and a write that never answers, when five seconds pass, then its transport signal aborts and the write fails without a second attempt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const entered = Promise.withResolvers<AbortSignal>();
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    attempts++;
    assert.ok(init?.signal);
    const signal = init.signal;
    entered.resolve(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Fixture abort', 'AbortError')), { once: true });
    });
  });
  const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));
  const write = workos.organizations.createOrganization({ name: 'FS01 fixture', externalId: 'FS01-fixture' });
  const signal = await entered.promise;

  t.mock.timers.tick(4_999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);

  await assert.rejects(write, { name: 'OauthException', message: 'Error: Request timeout' });
  assert.equal(signal.aborted, true);
  assert.equal(attempts, 1);
});
