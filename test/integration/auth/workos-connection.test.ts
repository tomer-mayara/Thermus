import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkOS } from '@workos-inc/node';
import { WorkOSOrganizations, workosMembershipReads } from '../../../src/accounts/providers/workos/workos-organizations.ts';
import { WorkOSFakeApi, type FakeAnswer } from '../../support/doubles/workos/workos-fake-api.ts';
import { openWorkOSConnection } from '../../../src/app/hosted-workos-application.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { workOSSettingsFor } from '../../support/fixtures/hosted-placeholder.ts';

const logger = { info() {}, error() {} };
const membershipId = 'om_01ALICE';

function directoryFor(workos: WorkOS): WorkOSOrganizations {
  return new WorkOSOrganizations({ authority: 'workos:client_test', memberships: workosMembershipReads(workos), userManagement: workos.userManagement, authorization: workos.authorization });
}

test('Given the production WorkOS connection, when organization and membership writes get a server error, then each sends one request with no retry', async (t) => {
  const requests: { path: string; method: string | undefined }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ path: new URL(input instanceof Request ? input.url : input).pathname, method: init?.method });
    return Response.json({ message: 'Fixture failure' }, { status: 500, headers: { 'Retry-After': '0' } });
  });
  const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));

  await assert.rejects(workos.organizations.createOrganization({ name: 'FS01 fixture', externalId: 'FS01-fixture' }), { status: 500 });
  await assert.rejects(workos.userManagement.createOrganizationMembership({ organizationId: 'org_01ACME', userId: 'user_01ADA', roleSlug: 'user' }), { status: 500 });

  await assert.rejects(directoryFor(workos).deleteMembership(membershipId), { status: 500 });

  assert.deepEqual(requests, [{ path: '/organizations', method: 'POST' }, { path: '/user_management/organization_memberships', method: 'POST' }, { path: `/user_management/organization_memberships/${membershipId}`, method: 'DELETE' }]);
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

test('Given the production WorkOS connection and a profile response with a stalled body, when five seconds pass, then getUser aborts the body and fails without retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const reading = Promise.withResolvers<AbortSignal>();
  const requests: { path: string; method: string | undefined }[] = [];
  let bodyAborted = false;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ path: new URL(input instanceof Request ? input.url : input).pathname, method: init?.method });
    assert.ok(init?.signal);
    const signal = init.signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        signal.addEventListener('abort', () => {
          bodyAborted = true;
          controller.error(new DOMException('Fixture body abort', 'AbortError'));
        }, { once: true });
      },
      pull() { reading.resolve(signal); },
    }, { highWaterMark: 0 });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));
  const profile = workos.userManagement.getUser('user_01ADA');
  const signal = await reading.promise;

  t.mock.timers.tick(4_999);
  assert.equal(signal.aborted, false);
  assert.equal(bodyAborted, false);
  t.mock.timers.tick(1);

  await assert.rejects(profile, { name: 'OauthException', message: 'Error: Request timeout' });
  assert.equal(signal.aborted, true);
  assert.equal(bodyAborted, true);
  assert.deepEqual(requests, [{ path: '/user_management/users/user_01ADA', method: 'GET' }]);
});

for (const { label, answer, outcome } of [
  { label: 'normal void completion', answer: { status: 204 }, outcome: 'applied' },
  { label: 'the documented no-effect refusal', answer: { status: 422, body: { code: 'organization_membership_directory_managed', message: 'Directory managed' } }, outcome: 'unsupported' },
  { label: 'a lost response after dispatch', answer: 'close', outcome: 'uncertain' },
] satisfies { label: string; answer: FakeAnswer; outcome: string }[]) {
  test(`Given the production WorkOS connection and ${label}, when the source directory deletes a membership, then its outcome is ${outcome} and the controlled wire receives one DELETE`, async (t) => {
    const fake = await WorkOSFakeApi.start(t);
    const path = `/user_management/organization_memberships/${membershipId}`;
    fake.answer(`DELETE ${path}`, answer);
    const wireFetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return wireFetch(new URL(url.pathname + url.search, fake.origin), init);
    });
    const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));
    const directory = directoryFor(workos);

    if (outcome === 'uncertain') await assert.rejects(directory.deleteMembership(membershipId));
    else assert.deepEqual(await directory.deleteMembership(membershipId), { outcome });

    assert.deepEqual(fake.takeRequests().map(({ method, path }) => ({ method, path })), [{ method: 'DELETE', path }]);
  });
}

test('Given the production WorkOS connection and a membership deletion that never answers, when five seconds pass, then the source directory throws with uncertain effect and sends no second DELETE', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const entered = Promise.withResolvers<AbortSignal>();
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(init?.method ?? 'GET');
    assert.ok(init?.signal);
    const signal = init.signal;
    entered.resolve(signal);
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Fixture abort', 'AbortError')), { once: true });
    });
  });
  const { workos } = await openWorkOSConnection(hostedRootConfig, logger, workOSSettingsFor(hostedRootConfig.publicBaseUrl));
  const deletion = directoryFor(workos).deleteMembership(membershipId);
  const signal = await entered.promise;

  t.mock.timers.tick(4_999);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);

  await assert.rejects(deletion, { name: 'OauthException', message: 'Error: Request timeout' });
  assert.equal(signal.aborted, true);
  assert.deepEqual(requests, ['DELETE']);
});
