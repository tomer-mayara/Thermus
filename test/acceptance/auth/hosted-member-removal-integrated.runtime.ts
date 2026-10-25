import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHostedToolOperations } from '../../../src/app/fetch-tool.ts';
import type { AuditSendOutcome } from '../../../src/logs/audit/audit-send.ts';
import { formsIn, formLabelled } from '../../support/drivers/browser/hosted-browser.ts';
import { connectMcpClient } from '../../support/drivers/mcp/mcp-sdk-client.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { AuditExportSenderSpy } from '../../support/doubles/logging/audit-export-sender-spy.ts';
import { RendererProcessDouble } from '../../support/doubles/website-fetcher/renderer-process-double.ts';
import { hostedFetchSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { organization, otherOrganization, ordinaryUser, remainingAdmin, removingAdmin, serveIntegratedRemovalSite } from './fixtures/member-removal-integrated-site.ts';

for (const reauthentication of [false, true]) {
  test(`Given a password-only hosted composition with two Admins, a User, other memberships and personal factors, when Members removes the User and then its Admin ${reauthentication ? 'and the provider requires reauthentication' : 'with its session retained'}, then current SQL receipts, counts, access denial, scope and usable selection agree`, { timeout: 60_000 }, async t => {
    const site = await serveIntegratedRemovalSite(t, { reauthentication });
    const { browser: admin } = await signInThroughServer(site, removingAdmin, organization);
    const { browser: user } = await signInThroughServer(site, ordinaryUser, organization);
    const { browser: survivor } = await signInThroughServer(site, remainingAdmin, organization);
    const { browser: otherUser } = await signInThroughServer(site, ordinaryUser, otherOrganization);
    const preserved = await site.readPreservedScope();
    assert.ok(preserved.every(scope => scope.factors.length === 1));
    assert.match((await admin.open('members')).body, /Active product members: 3/);
    const userId = site.world.membershipId(ordinaryUser, organization);
    const adminId = site.world.membershipId(removingAdmin, organization);
    const userToken = await site.world.connectToken(ordinaryUser, { org_id: organization });
    const adminToken = await site.world.connectToken(removingAdmin, { org_id: organization });
    const otherTokens = await Promise.all([ordinaryUser, removingAdmin].map(person => site.world.connectToken(person, { org_id: otherOrganization })));
    for (const token of [userToken, adminToken, ...otherTokens]) assert.equal((await site.discover(token)).status, 200);
    site.world.fake.takeRequests();

    const removedUser = await admin.submit(await removalForm(admin, userId));
    if (reauthentication) site.world.endSessionsOf(ordinaryUser);

    assert.equal(removedUser.status, 200, removedUser.body);
    const userReceipt = await site.store.readRemoval(organization);
    assert.equal(userReceipt.status, 'found');
    assert.equal(userReceipt.operation.membershipId, userId);
    assert.equal(userReceipt.operation.outcome, 'applied');
    assert.match((await admin.open('members')).body, /Active product members: 2/);
    assert.equal((await user.open('portal/access')).status, reauthentication ? 401 : 403);
    assert.equal((await site.discover(userToken)).status, 403);
    const otherAccess = reauthentication ? (await signInThroughServer(site, ordinaryUser, otherOrganization)).browser : otherUser;
    assert.equal((await otherAccess.open('portal/access')).status, 200);

    const removedSelf = await admin.submit(await removalForm(admin, adminId));
    if (reauthentication) site.world.endSessionsOf(removingAdmin);

    assert.equal(removedSelf.status, 200, removedSelf.body);
    assert.match(removedSelf.body, /href="\/team\/organizations/);
    assert.doesNotMatch(removedSelf.body, /MFA|authenticator|verification code|upgrade|payment required/i);
    const selfReceipt = await site.store.readRemoval(organization);
    assert.equal(selfReceipt.status, 'found');
    assert.equal(selfReceipt.operation.membershipId, adminId);
    assert.equal(selfReceipt.operation.outcome, 'applied');
    assert.equal((await admin.open('portal/access')).status, reauthentication ? 401 : 403);
    assert.equal((await admin.open('members')).status, reauthentication ? 401 : 403);
    assert.equal((await site.discover(adminToken)).status, 403);
    for (const token of otherTokens) assert.equal((await site.discover(token)).status, 200);
    const current = await survivor.open('members');
    assert.equal(current.status, 200, current.body);
    assert.match(current.body, /Active product members: 1/);
    assert.doesNotMatch(current.body, /integrated-(admin|user)@example\.com/);
    const lastAdmin = await survivor.submit(await removalForm(survivor, site.world.membershipId(remainingAdmin, organization)));
    assert.equal(lastAdmin.status, 409, lastAdmin.body);
    assert.match(lastAdmin.body, /another Admin/i);
    const refusalReceipt = await site.store.readRemoval(organization);
    assert.equal(refusalReceipt.status, 'found');
    assert.equal(refusalReceipt.operation.membershipId, site.world.membershipId(remainingAdmin, organization));
    assert.equal(refusalReceipt.operation.outcome, 'no-effect');
    assert.match((await survivor.open('members')).body, /Active product members: 1/);

    if (reauthentication) {
      assert.equal((await admin.open('organizations')).status, 401);
      const signInLink = /href="([^\"]*\/login[^\"]*)"/.exec(removedSelf.body)?.[1];
      assert.ok(signInLink, 'Self-removal must offer sign-in guidance');
      const start = await admin.open(signInLink);
      const state = start.location?.searchParams.get('state');
      assert.ok(state);
      const callback = await admin.open(`callback?code=${site.world.codeFor(removingAdmin)}&state=${encodeURIComponent(state)}`);
      assert.equal(callback.location?.pathname, '/team/organizations');
    }
    const selector = await admin.open('organizations');
    assert.equal(selector.status, 200, selector.body);
    assert.doesNotMatch(selector.body, /membership_id|revision|Member removed|not confirmed/);
    const choices = formsIn(selector.body);
    assert.deepEqual(choices.map(form => form.fields.organization_id), [otherOrganization]);
    assert.equal((await admin.submit(choices[0])).status, 303);
    const selected = await admin.open('portal/access');
    assert.equal(selected.status, 200, selected.body);
    assert.equal(JSON.parse(selected.body).organizationId, otherOrganization);
    assert.deepEqual(await site.readPreservedScope(), preserved);
    assert.deepEqual(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').map(request => request.path), [
      `/user_management/organization_memberships/${userId}`, `/user_management/organization_memberships/${adminId}`,
    ]);
    t.diagnostic('Real hosted HTTP composition and disposable verified-TLS PostgreSQL; WorkOS Password sessions and personal-factor sentinels are controlled. Factor preservation proves adapter scope only, not live provider semantics or MFA feasibility.');
  });
}

test('Given password-only access and enabled SQL-backed customer export, when Members confirms removal while the export sender fails, then the durable deletion stays confirmed without replay or an MFA or paid-feature requirement', { timeout: 60_000 }, async t => {
  const sender = new AuditExportSenderSpy();
  sender.held = true;
  t.after(() => sender.attempts.forEach(attempt => attempt.complete()));
  const failure: AuditSendOutcome = { kind: 'permanent_failure', reason: 'transport' };
  const site = await serveIntegratedRemovalSite(t, { sender });
  const { browser } = await signInThroughServer(site, removingAdmin, organization);
  const observed = Promise.withResolvers<void>();
  assert.equal(typeof site.storage.dispatch.settingsObserved, 'function');
  const dispatch = site.storage.dispatch as Required<typeof site.storage.dispatch>;
  const observe = dispatch.settingsObserved.bind(dispatch);
  t.mock.method(dispatch, 'settingsObserved', (tenant: string, revision: string | null) => { observe(tenant, revision); observed.resolve(); });
  const save = formLabelled(formsIn((await browser.open('logging')).body), 'Save');
  const saved = await browser.submit({ ...save, fields: { ...save.fields, endpoint: 'https://collector.example/v1/logs', destination: 'custom', axiom_dataset: '', auth: 'bearer', token: 'integrated-export-fixture-token', enabled: 'on' } });
  assert.equal(saved.status, 200, saved.body);
  await observed.promise;
  const enabled = await site.store.read(site.tenant);
  assert.equal(enabled.status, 'found');
  assert.equal(enabled.settings.enabled, true);
  const target = site.world.membershipId(ordinaryUser, organization);
  const form = await removalForm(browser, target);
  site.world.fake.takeRequests();

  const removed = await browser.submit(form);
  await sender.untilAttempts(1);
  const attempt = sender.attempts[0];
  attempt.complete(failure);
  const exported = attempt.event;

  assert.equal(removed.status, 200, removed.body);
  assert.doesNotMatch(removed.body, /MFA|authenticator|verification code|upgrade|payment required/i);
  assert.equal(exported.eventName, 'organization.changed');
  assert.equal(exported.organizationId, site.tenant);
  assert.ok(exported.eventName === 'organization.changed');
  assert.deepEqual([exported.action, exported.outcome, exported.target], ['remove-member', 'applied', { membershipId: target }]);
  const receipt = await site.store.readRemoval(organization);
  assert.equal(receipt.status, 'found');
  assert.equal(receipt.operation.outcome, 'applied');
  assert.equal((await browser.open('members')).status, 200);
  assert.match((await browser.open('members')).body, /Active product members: 2/);
  assert.deepEqual(await site.store.readRemoval(organization), receipt);
  assert.deepEqual(await site.store.read(site.tenant), enabled);
  assert.equal(sender.attempts.length, 1);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
  t.diagnostic('Enabled snapshots, Collector authorization and removal use real PostgreSQL. The external export sender returns a controlled permanent transport failure. No live Collector or provider claim.');
});

test('Given an authorized password-only Admin and unavailable Slice 2 PostgreSQL, when Members submits removal and ordinary product and MCP requests run, then removal is refused without deletion and product access still works', { timeout: 60_000 }, async t => {
  const logger = { info: (_message: string) => {}, error: (_message: string) => {} };
  const site = await serveIntegratedRemovalSite(t, { toolOperations: createHostedToolOperations(hostedFetchSettings, logger) });
  const { browser } = await signInThroughServer(site, removingAdmin, organization);
  const form = await removalForm(browser, site.world.membershipId(ordinaryUser, organization));
  const token = await site.world.connectToken(removingAdmin, { org_id: organization });
  const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL(site.world.mcpResourceUrl), {
    authProvider: { token: async () => token }, fetch: (input, init) => site.transport(new Request(input, init)),
  }));
  t.after(() => client.close());
  const url = 'https://source.example/integrated-removal-storage-outage';
  const text = 'Current product access works while membership-removal storage is unavailable.';
  RendererProcessDouble.install(t).serve(url, { finalUrl: url, html: `<html><body><main><p>${text}</p></main></body></html>` });
  await promisify(execFile)('docker', ['stop', '--time', '0', site.sql.container]);
  assert.deepEqual(await site.store.readRemoval(organization), { status: 'unavailable' });
  site.world.fake.takeRequests();

  const removed = await browser.submit(form);
  const access = await browser.open('portal/access');
  const product = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url, reason: 'Read during the removal storage outage' } });

  assert.equal(removed.status, 503, removed.body);
  assert.equal(access.status, 200, access.body);
  assert.equal(JSON.parse(access.body).organizationId, organization);
  assert.notEqual(product.isError, true);
  assert.deepEqual(product.content, [{ type: 'text', text }]);
  assert.equal((await site.discover(token)).status, 200);
  assert.equal((await browser.open('members')).status, 200);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 0);
  assert.equal(site.world.deletedMembershipIds.size, 0);
  t.diagnostic('The disposable PostgreSQL container is stopped before the HTTP removal POST. WorkOS and the renderer are controlled; the hosted HTTP/MCP composition, removal refusal and product pipeline are real.');
});
