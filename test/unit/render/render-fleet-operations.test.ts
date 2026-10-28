import assert from 'node:assert/strict';
import { test } from 'node:test';
import { image, json, platformWith, productionServiceId, signal } from './fixtures/render-fetch-stub.ts';

// The operations of the Render adapter for the fleet commands and the sweeps, with a stub of fetch: the deploy of an
// image by digest, the suspend, and the resume (sent one time each, behind the write guard), and the reads of the
// memory metric and of the restart events.

const digest = `sha256:${'ab'.repeat(32)}`;
const window = { startMs: Date.parse('2026-11-02T04:00:00Z'), endMs: Date.parse('2026-11-03T04:00:00Z') };
const accepted = (headers: Readonly<Record<string, string>> = {}) => new Response(null, { status: 202, headers });

test('Given a service that the registry owns, when an image is deployed, then one POST sends imageUrl, and a 201 gives the new deploy with its progress and digest', async () => {
  const { platform, sent, guarded } = platformWith([json(201, { id: 'dep-new', status: 'created', trigger: 'api', createdAt: '2026-11-02T10:00:00Z', image: { ref: image, sha: digest } }, { 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '9', 'Ratelimit-Reset': '12' })]);

  assert.deepEqual(await platform.deployImage('srv-a', image, signal), { status: 'started', deploy: { id: 'dep-new', progress: 'pending', status: 'created', imageDigest: digest } });

  assert.deepEqual(sent.map((call) => [call.method, call.url, call.body]), [['POST', 'https://api.render.com/v1/services/srv-a/deploys', { imageUrl: image }]]);
  assert.equal(sent[0]?.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(guarded, ['srv-a']);
});

test('Given a deploy that Render queues, when an image is deployed, then a 202 without a body gives a started deploy without its ID', async () => {
  const { platform } = platformWith([accepted()]);
  assert.deepEqual(await platform.deployImage('srv-a', image, signal), { status: 'started' });
});

test('Given a deploy answer that is not a 2xx, when an image is deployed, then it is sent one time only, and the outcome follows the answer', async () => {
  const cases: readonly [Response | Error, unknown][] = [
    [json(429, { message: 'Rate limit exceeded' }, { 'Retry-After': '7' }), { status: 'rate-limited', retryAfterMs: 7_000 }],
    [json(429, {}, { 'Ratelimit-Reset': '40' }), { status: 'rate-limited', retryAfterMs: 40_000 }],
    [json(404, { message: 'Not Found' }), { status: 'gone' }],
    [json(410, { message: 'Gone' }), { status: 'gone' }],
    [json(409, { message: 'a deploy is in progress' }), { status: 'refused', reason: 'Render answered 409: a deploy is in progress' }],
    [json(400, { message: 'invalid imageUrl' }), { status: 'refused', reason: 'Render answered 400: invalid imageUrl' }],
    [json(503, { message: 'Service Unavailable' }), { status: 'unknown', reason: 'Render answered 503: Service Unavailable' }],
    [new TypeError('fetch failed'), { status: 'unknown', reason: 'no answer: fetch failed' }],
    [json(201, { id: 'not-a-deploy' }), { status: 'unknown', reason: 'Render answered 201 without a valid deploy' }],
  ];
  for (const [answer, outcome] of cases) {
    const { platform, sent, clock } = platformWith([answer]);
    assert.deepEqual(await platform.deployImage('srv-a', image, signal), outcome);
    assert.equal(sent.length, 1, 'A deploy is never sent again');
    assert.deepEqual(clock.waits, []);
  }
});

test('Given an image that is not a reference by digest, when it is deployed, then the adapter refuses it before any request', async () => {
  for (const tagged of ['ghcr.io/tomer-mayara/thermus-hosted:latest', `ghcr.io/tomer-mayara/thermus-hosted@sha256:${'ab'.repeat(31)}`, '', `https://ghcr.io/x@${digest}`]) {
    const { platform, sent } = platformWith([]);
    assert.deepEqual(await platform.deployImage('srv-a', tagged, signal), { status: 'refused', reason: 'The Render adapter deploys only an image reference by digest.' });
    assert.deepEqual(sent, []);
  }
});

test('Given a service that the registry owns, when it is suspended or resumed, then one POST without a body goes, and a 202 gives accepted', async () => {
  const { platform, sent, guarded } = platformWith([
    accepted({ 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '9', 'Ratelimit-Reset': '40' }),
    accepted({ 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '8', 'Ratelimit-Reset': '39' }),
  ]);

  assert.deepEqual(await platform.suspendService('srv-a', signal), { status: 'accepted' });
  assert.deepEqual(await platform.resumeService('srv-a', signal), { status: 'accepted' });

  assert.deepEqual(sent.map((call) => [call.method, call.url, call.body]), [
    ['POST', 'https://api.render.com/v1/services/srv-a/suspend', undefined],
    ['POST', 'https://api.render.com/v1/services/srv-a/resume', undefined],
  ]);
  assert.deepEqual(guarded, ['srv-a', 'srv-a']);
});

test('Given a suspend or resume answer that is not a 2xx, when it is sent, then it goes one time only, and the outcome follows the answer', async () => {
  const cases: readonly [Response | Error, unknown][] = [
    [json(429, {}, { 'Retry-After': '30' }), { status: 'rate-limited', retryAfterMs: 30_000 }],
    [json(404, { message: 'Not Found' }), { status: 'gone' }],
    [json(400, { message: 'service is not suspended' }), { status: 'refused', reason: 'Render answered 400: service is not suspended' }],
    [json(500, {}), { status: 'unknown', reason: 'Render answered 500' }],
    [new TypeError('fetch failed'), { status: 'unknown', reason: 'no answer: fetch failed' }],
  ];
  for (const [answer, outcome] of cases) {
    for (const change of ['suspendService', 'resumeService'] as const) {
      const { platform, sent } = platformWith([answer instanceof Response ? answer.clone() : answer]);
      assert.deepEqual(await platform[change]('srv-a', signal), outcome);
      assert.equal(sent.length, 1);
    }
  }
});

test('Given the production service, a service that the registry does not own, or a bad service ID, when it is deployed, suspended, or resumed, then the adapter refuses it before any request', async () => {
  const { platform, sent, guarded } = platformWith([], (serviceId) => serviceId !== 'srv-other');
  for (const write of [(id: string) => platform.deployImage(id, image, signal), (id: string) => platform.suspendService(id, signal), (id: string) => platform.resumeService(id, signal)]) {
    assert.deepEqual(await write(productionServiceId), { status: 'refused', reason: `The Render adapter never changes the production service ${productionServiceId}.` });
    assert.deepEqual(await write('srv-other'), { status: 'refused', reason: 'The tenant registry does not own the Render service srv-other.' });
    assert.deepEqual(await write('srv-a/../srv-b'), { status: 'refused', reason: 'The Render adapter changes only a service with a Render service ID.' });
  }
  assert.deepEqual(sent, []);
  assert.deepEqual(guarded, ['srv-other', 'srv-other', 'srv-other'], 'Only a well-formed service ID that is not production reaches the registry');
});

const memorySeries = (serviceId: string, unit: string, points: readonly [string, number][]) => ({
  labels: [{ field: 'resource', value: serviceId }, { field: 'service', value: serviceId }, { field: 'instance', value: `${serviceId}-x7k2p` }],
  unit, values: points.map(([timestamp, value]) => ({ timestamp, value })),
});

test('Given live services, when their memory is read, then one memory read and one limit read name each service, and the result gives the peak and the limit of each', async () => {
  const { platform, sent } = platformWith([
    json(200, [memorySeries('srv-a', 'bytes', [['2026-11-02T10:00:00Z', 100], ['2026-11-02T22:00:00Z', 410]]), memorySeries('srv-b', 'bytes', [['2026-11-03T03:00:00Z', 64]])], { 'Ratelimit-Limit': '30' }),
    json(200, [memorySeries('srv-a', 'bytes', [['2026-11-03T04:00:00Z', 512]]), memorySeries('srv-b', 'bytes', [['2026-11-03T04:00:00Z', 2048]])]),
  ]);

  const read = await platform.memoryUse(['srv-a', 'srv-b', 'srv-c'], window, signal);

  assert.deepEqual(read, { status: 'found', services: new Map([['srv-a', { peakBytes: 410, limitBytes: 512 }], ['srv-b', { peakBytes: 64, limitBytes: 2048 }]]) });
  const query = '?resource=srv-a&resource=srv-b&resource=srv-c&startTime=2026-11-02T04%3A00%3A00.000Z&endTime=2026-11-03T04%3A00%3A00.000Z&resolutionSeconds=600';
  assert.deepEqual(sent.map((call) => [call.method, call.url]), [
    ['GET', `https://api.render.com/v1/metrics/memory${query}`],
    ['GET', `https://api.render.com/v1/metrics/memory-limit${query}`],
  ]);
});

test('Given no service, when the memory is read, then no request goes and the result is empty', async () => {
  const { platform, sent } = platformWith([]);
  assert.deepEqual(await platform.memoryUse([], window, signal), { status: 'found', services: new Map() });
  assert.deepEqual(sent, []);
});

test('Given a service without a limit series, when the memory is read, then its peak comes without a limit', async () => {
  const { platform } = platformWith([json(200, [memorySeries('srv-a', 'bytes', [['2026-11-02T10:00:00Z', 100]])]), json(200, [])]);
  assert.deepEqual(await platform.memoryUse(['srv-a'], window, signal), { status: 'found', services: new Map([['srv-a', { peakBytes: 100 }]]) });
});

test('Given a memory answer that fails, is invalid, or has another unit, when the memory is read, then the result is unavailable with the reason', async () => {
  const failed = platformWith([json(503, { message: 'Service Unavailable' }), json(503, { message: 'Service Unavailable' }), json(503, { message: 'Service Unavailable' })]);
  assert.deepEqual(await failed.platform.memoryUse(['srv-a'], window, signal), { status: 'unavailable', reason: 'Render answered 503: Service Unavailable' });
  assert.equal(failed.sent.length, 3, 'A metrics read repeats like each read');
  const invalid = platformWith([json(200, { series: [] })]);
  assert.deepEqual(await invalid.platform.memoryUse(['srv-a'], window, signal), { status: 'unavailable', reason: 'Render answered an invalid metrics list' });
  const unit = platformWith([json(200, [memorySeries('srv-a', 'GB', [['2026-11-02T10:00:00Z', 1]])])]);
  assert.deepEqual(await unit.platform.memoryUse(['srv-a'], window, signal), { status: 'unavailable', reason: 'Render answered memory in the unit GB, not bytes' });
  const limit = platformWith([json(200, []), json(400, { message: 'invalid resource' })]);
  assert.deepEqual(await limit.platform.memoryUse(['srv-a'], window, signal), { status: 'unavailable', reason: 'Render answered 400: invalid resource' });
});

test('Given a service ID that is not a Render service ID, when the memory is read, then the read leaves it out', async () => {
  const { platform, sent } = platformWith([json(200, []), json(200, [])]);
  assert.deepEqual(await platform.memoryUse(['srv-a', 'srv-a&resource=srv-b'], window, signal), { status: 'found', services: new Map() });
  assert.ok(sent.every((call) => !call.url.includes('srv-b')), 'No request names the other service');
});

const event = (type: string, timestamp: string, id = `evt-${timestamp}`) => ({ event: { id, timestamp, serviceId: 'srv-a', type, details: {} }, cursor: `cursor-${id}` });

test('Given the events of a service, when its restarts are counted, then one read of the window counts the failures and restarts of the server inside it, and no deploy event', async () => {
  const { platform, sent } = platformWith([json(200, [
    event('server_failed', '2026-11-02T22:01:00Z'),
    event('server_restarted', '2026-11-02T05:00:00Z'),
    event('deploy_started', '2026-11-02T12:00:00Z'),
    event('deploy_ended', '2026-11-02T12:01:00Z'),
    event('server_failed', '2026-11-01T12:00:00Z'),
  ])]);

  assert.deepEqual(await platform.restartCount('srv-a', window, signal), { status: 'found', restarts: 2 });

  assert.deepEqual(sent.map((call) => [call.method, call.url]), [
    ['GET', 'https://api.render.com/v1/services/srv-a/events?startTime=2026-11-02T04%3A00%3A00.000Z&endTime=2026-11-03T04%3A00%3A00.000Z&limit=100'],
  ]);
});

test('Given a full page of events, when the restarts are counted, then the next page follows its cursor, at most 10 pages', async () => {
  const fullPage = Array.from({ length: 100 }, (_item, index) => event('server_failed', `2026-11-02T10:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}Z`, `evt-${index}`));
  const two = platformWith([json(200, fullPage), json(200, [event('server_failed', '2026-11-02T09:00:00Z', 'evt-last')])]);
  assert.deepEqual(await two.platform.restartCount('srv-a', window, signal), { status: 'found', restarts: 101 });
  assert.ok(two.sent[1]?.url.endsWith('&limit=100&cursor=cursor-evt-99'));

  const endless = platformWith(Array.from({ length: 10 }, () => json(200, fullPage)));
  assert.deepEqual(await endless.platform.restartCount('srv-a', window, signal), { status: 'unavailable', reason: 'Render gave more than 10 pages of events' });
  assert.equal(endless.sent.length, 10);
});

test('Given a gone service, an event list that fails or is invalid, or a bad service ID, when the restarts are counted, then the result says so', async () => {
  const gone = platformWith([json(404, { message: 'Not Found' })]);
  assert.deepEqual(await gone.platform.restartCount('srv-a', window, signal), { status: 'gone' });
  const failed = platformWith([json(401, { message: 'Unauthorized' })]);
  assert.deepEqual(await failed.platform.restartCount('srv-a', window, signal), { status: 'unavailable', reason: 'Render answered 401: Unauthorized' });
  const invalid = platformWith([json(200, [{ cursor: 'c' }])]);
  assert.deepEqual(await invalid.platform.restartCount('srv-a', window, signal), { status: 'unavailable', reason: 'Render answered an invalid event list' });
  const badId = platformWith([]);
  assert.deepEqual(await badId.platform.restartCount('srv-a/../owners', window, signal), { status: 'gone' });
  assert.equal(badId.sent.length, 0);
});
