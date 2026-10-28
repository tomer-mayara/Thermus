import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RenderTenantPlatform } from '../../../src/tenancy/providers/render/render-tenant-platform.ts';
import { VirtualClock } from '../../support/doubles/tenants/virtual-clock.ts';

// The Render adapter with a stub of fetch: the request of each call from the SO-01c probe, the reading of each answer,
// the retry rule of reads and the delete, the single send of a create, the rate-limit headers, and the write guard.

const apiKey = 'rnd_unitTestKey0123456789';
const ownerId = 'tea-db8i6ceq1p3s73dev9og';
const image = `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'ab'.repeat(32)}`;
const productionServiceId = 'srv-db8mnqg473hc739d529g';
const signal = new AbortController().signal;

type Scripted = Response | Error;

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
}

function json(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function platformWith(answers: Scripted[], owned: (serviceId: string) => boolean = () => true) {
  const sent: Sent[] = [];
  const guarded: string[] = [];
  const clock = new VirtualClock();
  const fetchStub: typeof fetch = async (input, init = {}) => {
    sent.push({ url: String(input), method: init.method ?? 'GET', headers: new Headers(init.headers), body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    const answer = answers.shift();
    if (answer === undefined) throw new Error('No scripted answer');
    if (answer instanceof Error) throw answer;
    return answer;
  };
  const platform = new RenderTenantPlatform({
    apiKey, ownerId, registryCredentialId: 'rgc-dbg1h0142hec73da9ra0', image, clock, fetch: fetchStub,
    ownsService: async (serviceId) => { guarded.push(serviceId); return owned(serviceId); },
  });
  return { platform, sent, guarded, clock };
}

const serviceJson = (id: string, name: string, details: Record<string, unknown> = {}) => ({ id, name, slug: name, type: 'private_service', serviceDetails: { url: `${name}:10000`, openPorts: [{ port: 8080, protocol: 'TCP' }], ...details } });
const deployJson = (deploy: { readonly id: string; readonly status: string; readonly createdAt: string; readonly sha?: string }) => ({
  id: deploy.id, status: deploy.status, trigger: 'manual', createdAt: deploy.createdAt, image: { ref: image, ...(deploy.sha === undefined ? {} : { sha: deploy.sha }) },
});
const request = { name: 'thermus-tenant-org-01a', plan: '0.5c-512mb', environment: new Map([['THERMUS_ROLE', 'tenant'], ['OPERATION_CAPACITY', '5']]) };

test('Given a name, when the services are found, then one read lists the private services of the owner with that name and keeps only the exact name', async () => {
  const { platform, sent } = platformWith([json(200, [
    { service: serviceJson('srv-a', 'thermus-tenant-org-01a'), cursor: 'c1' },
    { service: serviceJson('srv-b', 'thermus-tenant-org-01a-old'), cursor: 'c2' },
  ])]);

  assert.deepEqual(await platform.findServices('thermus-tenant-org-01a', signal), { status: 'found', services: [{ id: 'srv-a', name: 'thermus-tenant-org-01a' }] });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.method, 'GET');
  assert.equal(sent[0]?.url, `https://api.render.com/v1/services?ownerId=${ownerId}&name=thermus-tenant-org-01a&type=private_service&limit=100`);
  assert.equal(sent[0]?.headers.get('Authorization'), `Bearer ${apiKey}`);
  assert.equal(sent[0]?.headers.get('Accept'), 'application/json');
  assert.equal(sent[0]?.body, undefined);
});

test('Given a list that is not a list of services, when the services are found, then the search is unavailable', async () => {
  for (const body of [{ services: [] }, [{ service: { id: '../srv-a', name: 'x' } }], [{ cursor: 'c1' }]]) {
    const { platform } = platformWith([json(200, body)]);
    assert.deepEqual(await platform.findServices('x', signal), { status: 'unavailable', reason: 'Render answered an invalid service list' });
  }
});

test('Given a create request, when the service is created, then one POST sends the image-backed private service with each variable, and the answer gives the service', async () => {
  const { platform, sent } = platformWith([json(201, { service: serviceJson('srv-new', request.name), deployId: 'dep-new' }, { 'Ratelimit-Limit': '20', 'Ratelimit-Remaining': '18', 'Ratelimit-Reset': '1588' })]);

  assert.deepEqual(await platform.createService(request, signal), { status: 'created', service: { id: 'srv-new', name: request.name } });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.method, 'POST');
  assert.equal(sent[0]?.url, 'https://api.render.com/v1/services');
  assert.equal(sent[0]?.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(sent[0]?.body, {
    type: 'private_service',
    name: request.name,
    ownerId,
    image: { ownerId, imagePath: image, registryCredentialId: 'rgc-dbg1h0142hec73da9ra0' },
    envVars: [{ key: 'THERMUS_ROLE', value: 'tenant' }, { key: 'OPERATION_CAPACITY', value: '5' }],
    serviceDetails: { runtime: 'image', plan: '0.5c-512mb', region: 'oregon', numInstances: 1 },
  });
});

test('Given a create answer without a valid service, when the service is created, then the outcome is unknown, because Render can have made it', async () => {
  const { platform } = platformWith([json(201, { service: { id: 'not-a-service' } })]);
  assert.deepEqual(await platform.createService(request, signal), { status: 'unknown', reason: 'Render answered 201 without a valid service' });
});

test('Given a create that Render limits, when the answer is 429, then the create is not sent again and the wait comes from Retry-After, else Ratelimit-Reset, else 60 s', async () => {
  const cases: readonly [Readonly<Record<string, string>>, number][] = [
    [{ 'Retry-After': '30', 'Ratelimit-Reset': '1500' }, 30_000],
    [{ 'Ratelimit-Reset': '120' }, 120_000],
    [{}, 60_000],
  ];
  for (const [headers, retryAfterMs] of cases) {
    const { platform, sent } = platformWith([json(429, { message: 'Rate limit exceeded' }, headers)]);
    assert.deepEqual(await platform.createService(request, signal), { status: 'rate-limited', retryAfterMs });
    assert.equal(sent.length, 1);
  }
});

test('Given a create with a 5xx answer or no answer, when the service is created, then it is sent one time only and the outcome is unknown', async () => {
  const failed = platformWith([json(503, { message: 'Service Unavailable' })]);
  assert.deepEqual(await failed.platform.createService(request, signal), { status: 'unknown', reason: 'Render answered 503: Service Unavailable' });
  assert.equal(failed.sent.length, 1);
  const lost = platformWith([new TypeError('fetch failed')]);
  assert.deepEqual(await lost.platform.createService(request, signal), { status: 'unknown', reason: 'no answer: fetch failed' });
  assert.equal(lost.sent.length, 1);
});

test('Given a create that Render refuses, when the answer is another 4xx, then the outcome is refused with the status and the bounded message', async () => {
  const { platform } = platformWith([json(400, { message: `invalid plan ${'x'.repeat(400)}` })]);
  const creation = await platform.createService(request, signal);
  assert.equal(creation.status, 'refused');
  assert.ok(creation.status === 'refused' && creation.reason.startsWith('Render answered 400: invalid plan xxx'));
  assert.ok(creation.status === 'refused' && creation.reason.length <= 'Render answered 400: '.length + 200);
});

test('Given a create answer with Ratelimit-Remaining 0, when the next create comes before the reset, then it waits without a request, and after the reset it sends', async () => {
  const { platform, sent, clock } = platformWith([
    json(201, { service: serviceJson('srv-one', request.name) }, { 'Ratelimit-Remaining': '0', 'Ratelimit-Reset': '1588' }),
    json(201, { service: serviceJson('srv-two', request.name) }, { 'Ratelimit-Remaining': '19', 'Ratelimit-Reset': '3600' }),
  ]);

  assert.equal((await platform.createService(request, signal)).status, 'created');
  assert.deepEqual(await platform.createService(request, signal), { status: 'rate-limited', retryAfterMs: 1_588_000 });
  assert.equal(sent.length, 1);
  await clock.sleep(1_588_000, signal);
  assert.equal((await platform.createService(request, signal)).status, 'created');
  assert.equal(sent.length, 2);
});

test('Given the deploys of a service, when the newest deploy is read, then one read of the deploy list gives the deploy with the latest creation time, its progress, and its digest', async () => {
  const digest = `sha256:${'cd'.repeat(32)}`;
  const statuses: readonly [string, string][] = [['live', 'live'], ['update_in_progress', 'pending'], ['created', 'pending'], ['update_failed', 'failed'], ['build_failed', 'failed'], ['canceled', 'failed'], ['pre_deploy_failed', 'failed'], ['deactivated', 'failed']];
  for (const [status, progress] of statuses) {
    const { platform, sent } = platformWith([json(200, [
      { deploy: deployJson({ id: 'dep-old', status: 'deactivated', createdAt: '2026-10-27T10:00:00Z', sha: digest }), cursor: 'c1' },
      { deploy: deployJson({ id: 'dep-new', status, createdAt: '2026-10-27T11:00:00Z', sha: digest }), cursor: 'c2' },
    ])]);
    assert.deepEqual(await platform.newestDeploy('srv-a', signal), { status: 'found', deploy: { id: 'dep-new', progress, status, imageDigest: digest } });
    assert.equal(sent[0]?.url, 'https://api.render.com/v1/services/srv-a/deploys?limit=20');
  }
});

test('Given no deploy, a deploy without a valid digest, a gone service, or a bad service ID, when the newest deploy is read, then the result says so', async () => {
  const empty = platformWith([json(200, [])]);
  assert.deepEqual(await empty.platform.newestDeploy('srv-a', signal), { status: 'none' });
  const noDigest = platformWith([json(200, [{ deploy: deployJson({ id: 'dep-a', status: 'live', createdAt: '2026-10-27T11:00:00Z', sha: 'sha256:short' }), cursor: 'c' }])]);
  assert.deepEqual(await noDigest.platform.newestDeploy('srv-a', signal), { status: 'found', deploy: { id: 'dep-a', progress: 'live', status: 'live' } });
  const gone = platformWith([json(404, { message: 'Not Found' })]);
  assert.deepEqual(await gone.platform.newestDeploy('srv-a', signal), { status: 'gone' });
  const badId = platformWith([]);
  assert.deepEqual(await badId.platform.newestDeploy('srv-a/../../owners', signal), { status: 'gone' });
  assert.equal(badId.sent.length, 0);
  const invalid = platformWith([json(200, [{ deploy: { id: 'dep-a' }, cursor: 'c' }])]);
  assert.deepEqual(await invalid.platform.newestDeploy('srv-a', signal), { status: 'unavailable', reason: 'Render answered an invalid deploy list' });
});

test('Given a live private service, when its internal address is read, then it is http:// with the host of serviceDetails.url and the port of serviceDetails.openPorts', async () => {
  const { platform, sent } = platformWith([json(200, { ...serviceJson('srv-a', 'thermus-tenant-org-01a-x7k2'), name: 'thermus-tenant-org-01a' })]);

  assert.deepEqual(await platform.internalAddress('srv-a', signal), { status: 'found', internalUrl: 'http://thermus-tenant-org-01a-x7k2:8080' });

  assert.equal(sent[0]?.url, 'https://api.render.com/v1/services/srv-a');
  assert.equal(sent[0]?.method, 'GET');
});

test('Given a service without open ports, without a URL, or with a host that is not a service name, when its internal address is read, then it is pending', async () => {
  const bodies = [
    serviceJson('srv-a', 'thermus-tenant-a', { openPorts: [] }),
    serviceJson('srv-a', 'thermus-tenant-a', { url: undefined }),
    serviceJson('srv-a', 'thermus-tenant-a', { url: '10.12.0.8:10000' }),
    serviceJson('srv-a', 'thermus-tenant-a', { url: 'Thermus_Tenant:10000' }),
    serviceJson('srv-a', 'thermus-tenant-a', { openPorts: [{ port: 8080, protocol: 'UDP' }] }),
  ];
  for (const body of bodies) {
    const { platform } = platformWith([json(200, body)]);
    assert.deepEqual(await platform.internalAddress('srv-a', signal), { status: 'pending' }, JSON.stringify(body));
  }
});

test('Given a read with a 5xx answer, a 429, or no answer, when it is read, then it repeats up to 3 attempts: 5 s after a failure and after Retry-After, at most 60 s, for a 429', async () => {
  const recovered = platformWith([json(503, {}), json(429, {}, { 'Retry-After': '2' }), json(200, [])]);
  assert.deepEqual(await recovered.platform.findServices('x', signal), { status: 'found', services: [] });
  assert.equal(recovered.sent.length, 3);
  assert.deepEqual(recovered.clock.waits, [5_000, 2_000]);

  const exhausted = platformWith([new TypeError('fetch failed'), new TypeError('fetch failed'), json(429, {}, { 'Retry-After': '600' })]);
  assert.deepEqual(await exhausted.platform.findServices('x', signal), { status: 'unavailable', reason: 'Render answered 429' });
  assert.equal(exhausted.sent.length, 3, 'The read goes at most 3 times');
  assert.deepEqual(exhausted.clock.waits, [5_000, 5_000]);

  const longLimit = platformWith([json(429, {}, { 'Retry-After': '600' }), json(200, [])]);
  await longLimit.platform.newestDeploy('srv-a', signal);
  assert.deepEqual(longLimit.clock.waits, [60_000]);

  const refused = platformWith([json(401, { message: 'Unauthorized' })]);
  assert.deepEqual(await refused.platform.internalAddress('srv-a', signal), { status: 'unavailable', reason: 'Render answered 401: Unauthorized' });
  assert.equal(refused.sent.length, 1, 'A 4xx other than 429 is not repeated');
});

test('Given a service that the registry owns, when it is deleted, then one DELETE goes, a 404 counts as deleted, and a 5xx or no answer repeats up to 3 attempts', async () => {
  const deleted = platformWith([new Response(null, { status: 204 })]);
  assert.deepEqual(await deleted.platform.deleteService('srv-a', signal), { status: 'deleted' });
  assert.deepEqual(deleted.sent.map((sent) => [sent.method, sent.url, sent.body]), [['DELETE', 'https://api.render.com/v1/services/srv-a', undefined]]);
  assert.deepEqual(deleted.guarded, ['srv-a']);

  const gone = platformWith([json(404, { message: 'Not Found' })]);
  assert.deepEqual(await gone.platform.deleteService('srv-a', signal), { status: 'deleted' });

  const repeated = platformWith([json(503, {}), new TypeError('fetch failed'), new Response(null, { status: 204 })]);
  assert.deepEqual(await repeated.platform.deleteService('srv-a', signal), { status: 'deleted' });
  assert.equal(repeated.sent.length, 3);

  const unavailable = platformWith([json(502, {}), json(502, {}), json(502, {})]);
  assert.deepEqual(await unavailable.platform.deleteService('srv-a', signal), { status: 'unavailable', reason: 'Render answered 502' });

  const refused = platformWith([json(409, { message: 'service is busy' })]);
  assert.deepEqual(await refused.platform.deleteService('srv-a', signal), { status: 'refused', reason: 'Render answered 409: service is busy' });
});

test('Given a write for the production service, a service that the registry does not own, or a bad service ID, when it is deleted, then the adapter refuses it before any request', async () => {
  const { platform, sent, guarded } = platformWith([], (serviceId) => serviceId !== 'srv-other');

  assert.deepEqual(await platform.deleteService(productionServiceId, signal), { status: 'refused', reason: `The Render adapter never changes the production service ${productionServiceId}.` });
  assert.deepEqual(guarded, [], 'The production service is refused before the registry is asked');
  assert.deepEqual(await platform.deleteService('srv-other', signal), { status: 'refused', reason: 'The tenant registry does not own the Render service srv-other.' });
  assert.deepEqual(await platform.deleteService('srv-a/../srv-b', signal), { status: 'refused', reason: 'The Render adapter changes only a service with a Render service ID.' });
  assert.deepEqual(sent, []);
});

test('Given any answer, when a result gives a reason, then the reason never holds the API key, and a stop of the caller rejects the call', async () => {
  const { platform } = platformWith([new TypeError(`fetch failed for https://api.render.com/v1/services`), json(500, { message: 'internal' }), json(400, { message: 'bad request' })]);
  const reasons = [
    JSON.stringify(await platform.createService(request, signal)),
    JSON.stringify(await platform.createService(request, signal)),
    JSON.stringify(await platform.createService(request, signal)),
  ];
  for (const reason of reasons) assert.ok(!reason.includes(apiKey), reason);

  const stopped = new AbortController();
  stopped.abort();
  const aborted = platformWith([]);
  await assert.rejects(aborted.platform.findServices('x', stopped.signal));
  await assert.rejects(aborted.platform.createService(request, stopped.signal));
  assert.equal(aborted.sent.length, 0);
});
