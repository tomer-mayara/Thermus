import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest, toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { ContextReportToolSpy, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { serveWorkOSSite } from '../../support/in-process/workos-site.ts';

for (const role of ['admin', 'user'] as const) {
  test(`S1-05 Given a verified creator and recipient, when they create, invite as ${role}, accept with a provider fake, and select the workspace, then application browser and MCP access match their roles and only the creator agreement is stored`, async (t) => {
    const tools = new ContextReportToolSpy();
    const site = await serveWorkOSSite(t, {
      config: hostedRootConfig,
      organizations: [],
      signupFake: true,
      signup: { enabled: true, documents: signupDocuments },
      buildServer: tools.buildServer,
    });
    const creator = { id: 'user_CREATOR', email: 'creator@example.com', firstName: 'Creator', emailVerified: true };
    const recipient = { id: 'user_RECIPIENT', email: 'recipient@example.com', firstName: 'Recipient', emailVerified: true };
    site.world.users = [creator, recipient];
    const { browser: owner } = await signInThroughServer(site, creator);
    const creationPage = await owner.open('signup');
    assert.equal(creationPage.status, 200, creationPage.body);
    assert.equal((creationPage.body.match(/type="checkbox"/g) ?? []).length, 1);
    assert.ok(creationPage.body.includes(signupDocuments.agreement.text));
    const creation = formLabelled(formsIn(creationPage.body), 'Create organization');
    const created = await owner.submit({ ...creation, fields: { ...creation.fields, organization_name: 'Journey Labs', agreement: 'accepted' } });
    assert.equal(created.status, 303, created.body);
    assert.equal(created.location?.href, site.publicBaseUrl);
    const ownerAccess = await owner.open('portal/access');
    assert.equal(ownerAccess.status, 200, ownerAccess.body);
    const organizationId = JSON.parse(ownerAccess.body).organizationId;
    assert.equal(typeof organizationId, 'string');
    assert.notEqual(organizationId, '');
    assert.equal(JSON.parse(ownerAccess.body).organizationName, 'Journey Labs');
    assert.deepEqual(JSON.parse(ownerAccess.body).roles, ['admin']);

    const members = await owner.open('members');
    assert.equal(members.status, 200, members.body);
    assert.doesNotMatch(members.body, /type="checkbox"|name="agreement"|multi-factor authentication is required/i);
    const invitation = formLabelled(formsIn(members.body), 'Send invitation');
    const sent = await owner.submit({ ...invitation, fields: { ...invitation.fields, email: recipient.email, role } });
    assert.equal(sent.status, 303, sent.body);
    assert.equal(site.world.invitations.length, 1);
    const pending = site.world.invitations[0];
    assert.ok(pending);
    assert.deepEqual([pending.organizationId, pending.email, pending.roleSlug, pending.state], [organizationId, recipient.email, role, 'pending']);

    // This provider step is a fake. It proves no native password or invitation behavior.
    site.world.acceptInvitation(pending.id);
    const { browser: joined, callback } = await signInThroughServer(site, recipient);
    assert.equal(callback.status, 303, callback.body);
    assert.equal(callback.location?.pathname, '/organizations');
    const selector = await joined.follow(callback);
    assert.equal(selector.status, 200, selector.body);
    assert.doesNotMatch(selector.body, /type="checkbox"|name="agreement"|multi-factor authentication is required/i);
    const choice = formLabelled(formsIn(selector.body), 'Journey Labs');
    assert.equal(choice.fields.organization_id, organizationId);
    const selected = await joined.submit(choice);
    assert.equal(selected.status, 303, selected.body);
    assert.equal(selected.location?.href, site.publicBaseUrl);
    const recipientAccess = await joined.open('portal/access');
    assert.equal(recipientAccess.status, 200, recipientAccess.body);
    assert.equal(JSON.parse(recipientAccess.body).organizationId, organizationId);
    assert.equal(JSON.parse(recipientAccess.body).organizationName, 'Journey Labs');
    assert.deepEqual(JSON.parse(recipientAccess.body).roles, [role]);
    const recipientMembers = await joined.open('members');
    assert.equal(recipientMembers.status, role === 'admin' ? 200 : 403);
    assert.doesNotMatch(recipientMembers.body, /type="checkbox"|name="agreement"|multi-factor authentication is required/i);

    for (const [browser, person, expectedRole] of [[owner, creator, 'admin'], [joined, recipient, role]] as const) {
      assert.equal((await browser.open('grants')).status, 404);
      const token = await site.world.connectToken(person, { org_id: organizationId });
      const report = await toolJson<ContextReport>(await site.transport(mcpRequest({
        url: site.world.mcpResourceUrl,
        method: 'tools/call',
        token,
        params: { name: ContextReportToolSpy.reportTool, arguments: {} },
      })));
      assert.equal(report.context.organizationId, organizationId);
      assert.equal(report.context.tenantId, `workos:${site.world.settings.clientId}:${organizationId}`);
      assert.equal(report.context.user.subject, person.id);
      assert.deepEqual(report.context.grants.map(({ role: grantedRole }) => grantedRole), [expectedRole]);
    }

    assert.equal(site.signupFake.organizations.length, 1);
    const metadata = site.signupFake.organizations[0]?.metadata;
    assert.ok(typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata));
    assert.ok('subject' in metadata && 'agreement_version' in metadata && 'agreement_sha256' in metadata && 'authority_accepted_at' in metadata);
    assert.equal(metadata.subject, creator.id);
    assert.equal(metadata.agreement_version, signupDocuments.agreement.version);
    assert.equal(metadata.agreement_sha256, createHash('sha256').update(signupDocuments.agreement.text).digest('hex'));
    assert.ok(typeof metadata.authority_accepted_at === 'string');
    assert.ok(Number.isFinite(Date.parse(metadata.authority_accepted_at)));
    const writes = site.world.fake.takeRequests().filter(({ method }) => method !== 'GET');
    assert.equal(writes.filter(({ method, path }) => method === 'POST' && path === '/organizations').length, 1);
    assert.equal(writes.filter(({ path }) => path === '/user_management/organization_memberships').length, 1);
    assert.equal(writes.filter(({ method }) => method === 'PATCH').length, 0);
  });
}
