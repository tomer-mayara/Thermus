import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LoggingRoutes } from '../../../src/interfaces/web/account/logging-routes.ts';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';

const context: RequestContext = { user: { authority: 'test', subject: 'admin' }, tenantId: 'trusted:a', organizationId: 'a', grants: [], permissions: ['admin-grants:manage'] };
const session: SignedInBrowserSession = { status: 'signed-in', user: context.user, csrfToken: 'csrf', mfaCompleted: false, cookies: [], selectOrganization: async () => ({ status: 'refused', cookies: [] }) };
const empty = { revision: null, endpoint: '', auth: 'none' as const, enabled: false, tokenPresent: false };
function fixture() {
  const writes: unknown[] = [];
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/nested/', organizationsPage: '/nested/organizations', service: { read: async () => ({ status: 'absent', settings: empty }), save: async (...args) => { writes.push(args); return { status: 'saved', settings: { ...empty, revision: '1' } }; } } });
  const request = (fields: Record<string, string> = {}, origin = 'https://example.test') => new Request('https://example.test/nested/logging/save', { method: 'POST', headers: { Origin: origin }, body: new URLSearchParams({ csrf_token: 'csrf', organization_id: 'trusted:a', expected_revision: '', endpoint: 'https://collector.example/v1/logs', auth: 'none', token: '', ...fields }) });
  return { routes, writes, request };
}
test('Given a password Admin, when Logging is read, then the disabled native form has no stored token', async () => {
  const { routes } = fixture();
  const response = await routes.handlerFor('/nested/logging')!(new Request('https://example.test/nested/logging'), session, context);
  const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /name="token"/); assert.match(html, /name="expected_revision"/); assert.doesNotMatch(html, /name="enabled"[^>]*checked/);
});
test('Given a valid form, when Save runs, then only the trusted tenant and settings reach the service', async () => {
  const { routes, writes, request } = fixture();
  assert.equal((await routes.handlerFor('/nested/logging/save')!(request({ enabled: 'on' }), session, context)).status, 303);
  assert.deepEqual(writes, [['trusted:a', { expectedRevision: null, endpoint: 'https://collector.example/v1/logs', auth: 'none', token: '', enabled: true }]]);
});
test('Given a forged, stale or extra-field form, when Save runs, then there is no write', async () => {
  for (const fields of [{ csrf_token: 'wrong' }, { organization_id: 'b' }, { extra: 'x' }] as Record<string, string>[]) {
    const { routes, writes, request } = fixture();
    assert.ok((await routes.handlerFor('/nested/logging/save')!(request(fields), session, context)).status >= 400); assert.deepEqual(writes, []);
  }
});
test('Given removed Admin permission, when Logging is read or saved, then no settings are returned or changed', async () => {
  const { routes, request, writes } = fixture();
  assert.equal((await routes.handlerFor('/nested/logging/save')!(request(), session, { ...context, permissions: [] })).status, 403); assert.deepEqual(writes, []);
});
test('Given an unconfirmed or throwing Save, when the browser gets its answer, then it can only read saved state', async () => {
  for (const save of [async () => ({ status: 'unconfirmed' as const }), async () => { throw new Error('secret-token'); }]) {
    const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/nested/', organizationsPage: '/nested/organizations', service: { read: async () => ({ status: 'absent', settings: empty }), save } });
    const { request } = fixture();
    const response = await routes.handlerFor('/nested/logging/save')!(request(), session, context);
    const html = await response.text();
    assert.equal(response.status, 503); assert.match(html, /unconfirmed/i); assert.match(html, /href="\/nested\/logging"/); assert.doesNotMatch(html, /<form|secret-token/); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});
test('Given an unavailable or throwing read, when Logging opens, then its safe page contains no cause or settings', async () => {
  for (const read of [async () => ({ status: 'unavailable' as const }), async () => { throw new Error('https://secret:credential@bad.example'); }]) {
    const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/', organizationsPage: '/organizations', service: { read, save: async () => ({ status: 'unavailable' }) } });
    const response = await routes.handlerFor('/logging')!(new Request('https://example.test/logging'), session, context);
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /secret|credential|bad.example|<form/);
  }
});
test('Given a hostile saved endpoint, when Logging renders, then values are escaped and the saved token stays write-only', async () => {
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://example.test/', organizationsPage: '/organizations', service: { read: async () => ({ status: 'found', settings: { ...empty, revision: 'r1', endpoint: '\"><script>bad</script>', auth: 'bearer', tokenPresent: true } }), save: async () => ({ status: 'unavailable' }) } });
  const response = await routes.handlerFor('/logging')!(new Request('https://example.test/logging'), session, context);
  const html = await response.text();
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/); assert.match(html, /A token is saved/); assert.match(html, /name="token"[^>]*value=""/); assert.match(response.headers.get('Content-Security-Policy')!, /form-action 'self'/);
});
test('Given an invalid origin, oversized body or duplicate field, when Save arrives, then the service gets no write', async () => {
  const { routes, request, writes } = fixture();
  const handler = routes.handlerFor('/nested/logging/save')!;
  assert.equal((await handler(request({}, 'https://other.test'), session, context)).status, 403);
  const duplicate = request();
  const body = new URLSearchParams(await duplicate.text()); body.append('auth', 'none');
  assert.ok((await handler(new Request(duplicate.url, { method: 'POST', headers: { Origin: 'https://example.test' }, body }), session, context)).status >= 400);
  assert.equal((await handler(request({ token: 'x'.repeat(17000) }), session, context)).status, 413);
  assert.deepEqual(writes, []);
});
test('Given an aborted request, when its valid form finishes reading, then no Save starts', async () => {
  const { routes, request, writes } = fixture();
  const controller = new AbortController();
  const original = request();
  const aborted = new Request(original, { signal: controller.signal });
  controller.abort();
  await assert.rejects(routes.handlerFor('/nested/logging/save')!(aborted, session, context));
  assert.deepEqual(writes, []);
});
