import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { accountRequest, adminGrant, allowedFor, ann, contextOf, organization, serve, signedIn, userGrant } from './fixtures/account-routes-fixtures.ts';

const adminContext = contextOf(ann, [adminGrant], adminGrant.permissions);

function adminSite() {
  return serve({ sessions: new Map([['session=ann', signedIn(ann)]]),
    decisions: new Map([[ann.subject, allowedFor(adminContext)]]),
    organizations: new Map([[ann.subject, [organization('org-a', '<img src=x onerror=alert(1)>', true)]]]) });
}

test('Given an authorized name containing markup, when Quick start opens, then the name is escaped and only selected workspace data is read', async () => {
  const site = adminSite();
  const answer = await site.routes.handle(accountRequest('/quick-start?organization_id=org-b&organization_name=Injected', 'session=ann'));
  assert.equal(answer.status, 200);
  const document = parseHTML(await answer.text()).document;
  assert.equal(document.querySelector('.workspace-name')?.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelector('img[src=x]'), null);
  assert.deepEqual(site.organizations.selections, [{ user: ann, organizationId: 'org-a' }]);
  assert.deepEqual(site.organizations.administrationCalls, []);
});

for (const [label, context] of [
  ['User', contextOf(ann, [userGrant], userGrant.permissions)],
  ['another subject', { ...adminContext, user: { ...ann, subject: 'other' } }],
  ['another authority', { ...adminContext, user: { ...ann, authority: 'other' } }],
  ['another selected workspace', { ...adminContext, user: { ...ann, selectedOrganizationId: 'org-b' } }],
  ['another workspace', { ...adminContext, organizationId: 'org-b' }],
  ['missing product permission', { ...adminContext, permissions: [] }],
] as const) {
  test(`Given ${label}, when Quick start is requested, then access is refused before a name lookup`, async () => {
    const site = serve({ sessions: new Map([['session=ann', signedIn(ann)]]), decisions: new Map([[ann.subject, allowedFor(context)]]) });
    assert.equal((await site.routes.handle(accountRequest('/quick-start', 'session=ann'))).status, 403);
    assert.deepEqual(site.organizations.selections, []);
  });
}

for (const organizationName of ['', '   ']) {
  test(`Given an unavailable workspace name ${JSON.stringify(organizationName)}, when Quick start opens, then no guide is guessed`, async () => {
    const site = adminSite();
    site.organizations.authorizeSelection = async () => organization('org-a', organizationName);
    assert.equal((await site.routes.handle(accountRequest('/quick-start', 'session=ann'))).status, 403);
  });
}

test('Given failed or missing organization access, when Quick start opens, then no guide is rendered', async () => {
  const site = adminSite();
  site.organizations.authorizeSelection = async () => undefined;
  assert.equal((await site.routes.handle(accountRequest('/quick-start', 'session=ann'))).status, 403);
  site.organizations.authorizeSelection = async () => { throw new Error('provider-secret'); };
  const failure = await site.routes.handle(accountRequest('/quick-start', 'session=ann'));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /provider-secret|Quick start/);
});

test('Given a current Admin, when HEAD or POST requests Quick start, then HEAD has no body and POST cannot change state', async () => {
  const site = adminSite();
  const head = await site.routes.handle(accountRequest('/quick-start', 'session=ann', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.match(head.headers.get('Content-Security-Policy') ?? '', /style-src 'sha256-/);
  const post = await site.routes.handle(accountRequest('/quick-start', 'session=ann', { method: 'POST' }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
});

test('Given a portal base path and a separate configured MCP host, when Quick start opens, then scoped links and the guide preserve both configurations', async () => {
  const site = serve({ publicBaseUrl: 'https://thermus.example/team', sessions: new Map([['session=ann', signedIn(ann)]]),
    decisions: new Map([[ann.subject, allowedFor(adminContext)]]), organizations: new Map([[ann.subject, [organization('org-a', 'Acme')]]]) });
  const page = await site.routes.handle(accountRequest('/team/quick-start', 'session=ann'));
  assert.equal(page.status, 200);
  const document = parseHTML(await page.text()).document;
  assert.equal(document.querySelector('nav [aria-current="page"]')?.getAttribute('href'), 'https://thermus.example/team/quick-start');
  assert.match(document.querySelector('textarea')?.textContent ?? '', /https:\/\/mcp\.thermus\.example\/configured-mcp/);
  assert.match(document.querySelector('textarea')?.textContent ?? '', /https:\/\/thermus\.example\/team\/logging/);
});

test('Given a pending Quick start name lookup, when the browser aborts, then no page or failure report is returned', async () => {
  const site = adminSite();
  const lookup = Promise.withResolvers<ReturnType<typeof organization> | undefined>();
  const started = Promise.withResolvers<void>();
  site.organizations.authorizeSelection = async () => { started.resolve(); return lookup.promise; };
  const abort = new AbortController();
  const answer = site.routes.handle(accountRequest('/quick-start', 'session=ann', { signal: abort.signal }));
  await started.promise;
  const reason = new DOMException('Browser left Quick start', 'AbortError');
  abort.abort(reason);
  await assert.rejects(answer, error => error === reason);
  lookup.resolve(organization('org-a', 'Acme'));
  assert.deepEqual(site.failures, []);
});
