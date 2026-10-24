import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { RequestContext } from '../../../src/accounts/identity/access-context.ts';
import type { SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';
import { LoggingRoutes } from '../../../src/interfaces/web/account/logging-routes.ts';
import { DestinationSettingsService } from '../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationSettings, DestinationSettingsStore, StoredDestinationSettings } from '../../../src/logs/audit/destination-settings-store.ts';
import { HostedBrowser, formLabelled, formsIn } from '../drivers/browser/hosted-browser.ts';

interface DestinationTestSubmission {
  readonly endpoint: string;
  readonly auth: 'none' | 'bearer';
  readonly token: string;
}

const tenantId = 'runtime-test-tenant';
const user = { authority: 'runtime-test-authority', subject: 'runtime-test-admin' };
const context: RequestContext = { user, tenantId, organizationId: 'runtime-provider-org', grants: [], permissions: ['admin-grants:manage'] };
const session: SignedInBrowserSession = {
  status: 'signed-in', user, csrfToken: 'runtime-test-csrf', mfaCompleted: true, cookies: [],
  selectOrganization: async () => ({ status: 'refused', cookies: [] }),
};

// The store and decided access context are the two test boundaries. The routes, settings owner, codec, and sender are real.
class DestinationStoreFake implements DestinationSettingsStore {
  current: StoredDestinationSettings | undefined;
  saves = 0;
  async read(tenant: string) {
    assert.equal(tenant, tenantId);
    return this.current === undefined ? { status: 'absent' as const } : { status: 'found' as const, settings: { ...this.current } };
  }
  async save(tenant: string, revision: string | null, desired: DestinationSettings) {
    assert.equal(tenant, tenantId);
    assert.equal(revision, this.current?.revision ?? null);
    this.saves++;
    this.current = { ...desired, revision: `runtime-saved-${this.saves}` };
    return { status: 'saved' as const, settings: { ...this.current } };
  }
}

const submissions: DestinationTestSubmission[] = JSON.parse(await readFile('/fixture/destination-tests.json', 'utf8'));
const results = [];
for (const submission of submissions) {
  const store = new DestinationStoreFake();
  const service = new DestinationSettingsService(store, new Uint8Array(32).fill(7));
  const saved = await service.save(tenantId, { expectedRevision: null, endpoint: submission.endpoint, auth: submission.auth, enabled: false, token: submission.token });
  assert.equal(saved.status, 'saved');
  const before = JSON.stringify(store.current);
  const routes = new LoggingRoutes({ publicBaseUrl: 'https://runtime.thermus.test/', organizationsPage: '/organizations', service });
  const browser = new HostedBrowser(async (request) => {
    const handler = routes.handlerFor(new URL(request.url).pathname);
    assert.ok(handler);
    return handler(request, session, context);
  }, 'https://runtime.thermus.test/');
  const page = await browser.open('/logging');
  assert.equal(page.status, 200);
  assert.ok(!page.body.includes(submission.token) || submission.token === '');
  assert.match(page.body, /name="token"[^>]*value=""/);
  assert.doesNotMatch(page.body, /name="enabled" checked/);
  const form = formLabelled(formsIn(page.body), 'Test saved destination');
  const endpoint = /name="endpoint"[^>]*value="([^"]*)"/.exec(page.body)?.[1];
  assert.ok(endpoint);
  assert.equal(endpoint, submission.endpoint);
  const fields = { ...form.fields, endpoint, token: '' };
  const unsaved = await browser.submit({ ...form, fields: { ...fields, token: 'unsaved-runtime-token' } });
  const tested = await browser.submit({ ...form, fields });
  const after = await service.read(tenantId);
  results.push({
    unsaved: { status: unsaved.status, body: unsaved.body },
    tested: { status: tested.status, body: tested.body },
    revision: store.current?.revision,
    unchanged: before === JSON.stringify(store.current),
    saves: store.saves,
    settings: after.status === 'found' ? after.settings : null,
  });
}
process.stdout.write(`${JSON.stringify(results)}\n`);
