import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoggingRoutes } from '../../../src/interfaces/web/account/logging-routes.ts';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';

const context: RequestContext = { user: { authority: 'trusted', subject: 'admin' }, tenantId: 'trusted:a', organizationId: 'a', grants: [], permissions: ['admin-grants:manage'] };
const session: SignedInBrowserSession = { status: 'signed-in', user: context.user, csrfToken: 'csrf', mfaCompleted: false, cookies: [], selectOrganization: async () => ({ status: 'refused', cookies: [] }) };
const fields = { csrf_token: 'csrf', organization_id: 'trusted:a', expected_revision: 'r1', endpoint: 'https://collector.example/v1/logs', destination: 'custom', auth: 'bearer', token: '' };

test('Given edited protected settings, when Test is submitted, then Save runs first and only its returned version reaches Test', async () => {
  const saved = { revision: 'r2', endpoint: 'https://saved.example/v1/logs', axiomDataset: 'saved-dataset', auth: 'bearer' as const, enabled: true, tokenPresent: true, tokenPreview: 'priv****' };
  const calls: unknown[] = [];
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/nested/', organizationsPage: '/nested/organizations', service: {
    read: async () => ({ status: 'found', settings: saved }),
    save: async (...args) => { calls.push(['save', ...args]); return { status: 'saved', settings: saved }; },
    test: async (...args) => { calls.push(['test', ...args]); return { status: 'tested', revision: 'r2', outcome: { kind: 'accepted' } }; },
  } });
  const request = new Request('https://example.test/nested/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body: new URLSearchParams({ ...fields, token: 'private-new-token' }) });
  const handler = routes.handlerFor('/nested/logging/test');
  assert.ok(handler);
  const response = await handler(request, session, context);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Settings saved/);
  assert.match(html, /Destination accepted the Test event/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /<form/);
  assert.match(html, /name="expected_revision" value="r2"/);
  assert.doesNotMatch(html, /private-new-token/);
  assert.deepEqual(calls, [
    ['save', 'trusted:a', { expectedRevision: 'r1', endpoint: fields.endpoint, auth: 'bearer', token: 'private-new-token', enabled: false }],
    ['test', 'trusted:a', { expectedRevision: 'r2', endpoint: saved.endpoint, axiomDataset: saved.axiomDataset, auth: 'bearer', token: '', enabled: true }, context.user, request.signal],
  ]);
});

function testRoutes(answer: import('../../../src/logs/audit/destination-settings-service.ts').DestinationTestResult | Error = { status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } }) {
  const calls: unknown[] = [];
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/nested/', organizationsPage: '/nested/organizations', service: {
    read: async (...args) => { calls.push(['read', ...args]); return { status: 'found', settings: { revision: 'r1', endpoint: fields.endpoint, auth: 'bearer', enabled: false, tokenPresent: true } }; },
    save: async (...args) => { calls.push(['save', ...args]); return { status: 'unchanged', settings: { revision: 'r1', endpoint: fields.endpoint, auth: 'bearer', enabled: false, tokenPresent: true } }; },
    test: async (...args) => { calls.push(args); if (answer instanceof Error) throw answer; return answer; },
  } });
  const request = (changes: Record<string, string> = {}, headers: Record<string, string> = {}) => new Request('https://example.test/nested/logging/test', {
    method: 'POST', headers: { Origin: 'https://example.test', ...headers }, body: new URLSearchParams({ ...fields, ...changes }),
  });
  const handler = routes.handlerFor('/nested/logging/test'); assert.ok(handler);
  return { handler, request, calls };
}

for (const [name, changes, headers, status] of [
  ['foreign origin', {}, { Origin: 'https://foreign.example' }, 403],
  ['missing origin', {}, { Origin: '' }, 403],
  ['forged CSRF', { csrf_token: 'forged' }, {}, 403],
  ['another tenant', { organization_id: 'trusted:b' }, {}, 409],
  ['unknown field', { user: 'forged' }, {}, 400],
  ['invalid auth', { auth: 'basic' }, {}, 400],
  ['large body', { token: 'x'.repeat(17000) }, {}, 413],
  ['unsupported media', {}, { 'Content-Type': 'application/json' }, 415],
] as const) {
  test(`Given ${name}, when Test is submitted, then the service receives no operation`, async () => {
    const { handler, request, calls } = testRoutes();
    const response = await handler(request(changes, headers), session, context);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(calls, []);
  });
}

test('Given duplicate fields or a missing required field, when Test is submitted, then exact form checks refuse it', async () => {
  for (const change of [(body: URLSearchParams) => body.append('auth', 'none'), (body: URLSearchParams) => body.delete('endpoint')]) {
    const { handler, calls } = testRoutes();
    const body = new URLSearchParams(fields); change(body);
    const response = await handler(new Request('https://example.test/nested/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body }), session, context);
    assert.equal(response.status, 400);
    assert.deepEqual(calls, []);
  }
});

test('Given removed Admin permission or a non-POST method, when Test is requested, then Test does not start', async () => {
  const { handler, request, calls } = testRoutes();
  assert.equal((await handler(request(), session, { ...context, permissions: [] })).status, 403);
  for (const method of ['GET', 'HEAD', 'PUT']) {
    const response = await handler(new Request('https://example.test/nested/logging/test', { method }), session, context);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  }
  assert.deepEqual(calls, []);
});

test('Given an aborted valid Test request, when form reading ends, then Test does not start', async () => {
  const { handler, request, calls } = testRoutes();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(handler(new Request(request(), { signal: controller.signal }), session, context));
  assert.deepEqual(calls, []);
});

const sendAnswers = [
  [{ kind: 'accepted' }, 200, /Destination accepted the Test event\./],
  [{ kind: 'warning' }, 200, /with a warning/],
  [{ kind: 'partial_rejection', rejectedRecords: 1 }, 502, /Destination rejected the Test event/],
  [{ kind: 'permanent_failure', reason: 'http_status', statusCode: 401 }, 502, /Test attempt failed/],
  [{ kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 1000 }, 503, /could not complete/],
  [{ kind: 'unconfirmed', reason: 'transport' }, 503, /result is unconfirmed/],
  [{ kind: 'cancelled' }, 409, /Test was cancelled/],
  [{ kind: 'busy' }, 429, /Test is busy/],
] as const;
for (const [outcome, status, text] of sendAnswers) {
  test(`Given the typed ${outcome.kind} sender result, when Test returns, then fixed safe text reaches the browser`, async () => {
    const { handler, request } = testRoutes({ status: 'tested', revision: 'private-revision', outcome });
    const response = await handler(request(), session, context);
    const html = await response.text();
    assert.equal(response.status, status);
    assert.match(html, text);
    assert.match(html, /Settings saved/);
    assert.doesNotMatch(html, /private-revision|http_status|retryAfter|transport|401|1000/);
    assert.match(html, /class="site-header"/);
    assert.match(html, /<form/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });
}

for (const [status, code, text] of [
  ['conflict', 409, /saved destination changed or is absent/],
  ['unavailable', 503, /settings are unavailable/],
  ['unsaved', 409, /saved settings could not be matched/],
  ['busy', 429, /Test is busy/],
  ['cancelled', 409, /Test was cancelled/],
  ['unconfirmed', 503, /could not be confirmed/],
] as const) {
  test(`Given the ${status} operation result, when Test returns, then no stale sender result is shown`, async () => {
    const { handler, request } = testRoutes({ status });
    const response = await handler(request(), session, context);
    const html = await response.text();
    assert.equal(response.status, code);
    assert.match(html, text);
    assert.doesNotMatch(html, /Destination accepted/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  });
}

test('Given a secret-bearing Test exception, when the operation fails, then the cause stays out of its safe answer', async () => {
  const { handler, request } = testRoutes(new Error('private-token https://private.receiver/internal raw-diagnostic'));
  const response = await handler(request(), session, context);
  const html = await response.text();
  assert.equal(response.status, 503);
  assert.match(html, /could not be confirmed/);
  assert.doesNotMatch(html, /private-token|private.receiver|raw-diagnostic/);
});

test('Given a Save-only service, when Test is submitted, then it fails closed with no Save or settings read', async () => {
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/', organizationsPage: '/organizations', service: {
    read: async () => { throw new Error('Test must not read outside its operation'); },
    save: async () => { throw new Error('Test must not Save'); },
  } });
  const handler = routes.handlerFor('/logging/test'); assert.ok(handler);
  const request = new Request('https://example.test/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body: new URLSearchParams(fields) });
  const response = await handler(request, session, context);
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Audit logs settings are unavailable/);
});

for (const saveResult of [
  { status: 'invalid', reason: 'endpoint' }, { status: 'conflict' }, { status: 'unconfirmed' }, { status: 'unavailable' },
] as const) {
  test(`Given a ${saveResult.status} Save, when Test is selected, then no Test starts and a styled recovery answer prevents an uncertain retry`, async () => {
    let tests = 0; let reads = 0;
    const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/nested/', organizationsPage: '/nested/organizations', service: {
      read: async () => { reads++; return { status: 'found', settings: { revision: 'fresh-r3', endpoint: fields.endpoint, auth: 'bearer', enabled: false, tokenPresent: true } }; },
      save: async () => saveResult,
      test: async () => { tests++; return { status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } }; },
    } });
    const handler = routes.handlerFor('/nested/logging/test'); assert.ok(handler);
    const response = await handler(new Request('https://example.test/nested/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body: new URLSearchParams(fields) }), session, context);
    const html = await response.text();
    assert.equal(response.status, saveResult.status === 'invalid' ? 400 : saveResult.status === 'conflict' ? 409 : 503);
    assert.match(html, /class="site-header"/);
    assert.match(html, /<title>Audit logs · Thermus<\/title>/);
    assert.equal(tests, 0);
    if (saveResult.status === 'invalid' || saveResult.status === 'conflict') {
      assert.equal(reads, 1);
      assert.match(html, /name="expected_revision" value="fresh-r3"/);
      assert.doesNotMatch(html, /name="expected_revision" value="r1"/);
    } else {
      assert.equal(reads, 0);
      assert.doesNotMatch(html, /<form/);
      assert.match(html, /href="\/nested\/logging"/);
    }
  });
}

test('Given a secret-bearing Save exception, when Test is submitted, then its styled unconfirmed answer has no form and no read or send', async () => {
  let reads = 0; let tests = 0;
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/', organizationsPage: '/organizations', service: {
    read: async () => { reads++; return { status: 'unavailable' }; },
    save: async () => { throw new Error('private-token private-save-cause'); },
    test: async () => { tests++; return { status: 'unavailable' }; },
  } });
  const handler = routes.handlerFor('/logging/test'); assert.ok(handler);
  const response = await handler(new Request('https://example.test/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body: new URLSearchParams(fields) }), session, context);
  const html = await response.text();
  assert.equal(response.status, 503);
  assert.match(html, /Save unconfirmed/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /No Test was sent/);
  assert.doesNotMatch(html, /private-token|private-save-cause|<form/);
  assert.deepEqual([reads, tests], [0, 0]);
});

test('Given cancellation after Save, when the saved result returns, then Test does not start', async () => {
  const controller = new AbortController();
  let tests = 0;
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/', organizationsPage: '/organizations', service: {
    read: async () => ({ status: 'unavailable' }),
    save: async () => { controller.abort(); return { status: 'saved', settings: { revision: 'r2', endpoint: fields.endpoint, auth: 'bearer', enabled: false, tokenPresent: true } }; },
    test: async () => { tests++; return { status: 'unavailable' }; },
  } });
  const handler = routes.handlerFor('/logging/test'); assert.ok(handler);
  const request = new Request('https://example.test/logging/test', { method: 'POST', headers: { Origin: 'https://example.test' }, body: new URLSearchParams(fields), signal: controller.signal });
  await assert.rejects(handler(request, session, context));
  assert.equal(tests, 0);
});
