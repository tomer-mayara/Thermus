import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, test, type TestContext } from 'node:test';
import { SdkHttpError, StreamableHTTPClientTransport, type Client } from '@modelcontextprotocol/client';
import { formLabelled, formsIn } from '../../../support/drivers/browser/hosted-browser.ts';
import { connectMcpClient } from '../../../support/drivers/mcp/mcp-sdk-client.ts';
import { signupDocuments } from '../../../support/fixtures/signup-documents.ts';
import { authorizeWithConnect } from '../../../support/hosted-live/connect-grant.ts';
import { LiveRun, once } from '../../../support/hosted-live/live-run.ts';
import { serverGet, serverPost, sessionJson, signInThroughPortal } from '../../../support/hosted-live/portal-visit.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import { readToken } from '../../../support/hosted-live/tokens.ts';
import { personalExternalId } from '../../../support/hosted-live/signup-fixtures.ts';

const options = { timeout: 300_000 };
const pageUrl = 'https://example.com/';

async function connectClient(t: TestContext, run: LiveRun, token: string): Promise<Client> {
  const client = await connectMcpClient(t, new StreamableHTTPClientTransport(new URL('mcp', (await run.site()).thermusUrl), { authProvider: { token: async () => token } }), { checkEra: false, timeoutMs: 15_000 });
  t.after(() => client.close());
  return client;
}

async function fetchPage(client: Client, run: LiveRun, expected: { readonly subject: string; readonly organizationId: string }): Promise<void> {
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: pageUrl, reason: 'Read the public example page for the signup proof' } });
  assert.notEqual(result.isError, true, 'The real page fetch failed.');
  assert.ok(result.content.some((content) => content.type === 'text' && content.text.trim().length > 0), 'The real page fetch returned no Markdown text.');
  const records = (await run.site()).log.lines.filter((line) => line.startsWith('INFO {"event":"mcp.tool.completed"')).map((line) => JSON.parse(line.slice(5)) as Record<string, unknown>);
  const completion = records.at(-1);
  assert.ok(completion, 'The fetch has no completion record.');
  assert.equal(completion.subject, expected.subject);
  assert.equal(completion.tenantId, `workos:${run.settings.clientId}:${expected.organizationId}`);
  assert.equal(completion.status, 'success');
}

// This suite runs last because its test-only composition uses the same registered localhost callback.
export function describeSignupServerCases(previous: LiveRun): void {
  const run = new LiveRun(previous.settings, { signupDocuments, existingFixtures: previous.fixtures });
  const activated = once(async () => {
    const { user } = await run.signupFixtures();
    assert.equal((await (await run.workos.userManagement.listOrganizationMemberships({ userId: user.id })).autoPagination()).length, 0);
    const visit = await signInThroughPortal(run, user, undefined, 'organizations');
    await visit.page.goto(`${localOrigin}/signup`);
    const agreement = visit.page.getByRole('checkbox');
    assert.equal(await agreement.isChecked(), false);
    const originalForm = formsIn((await serverGet(visit.page, 'signup')).body).find(({ action }) => action === '/signup');
    assert.ok(originalForm);
    await visit.page.getByRole('textbox', { name: 'Organization name', exact: true }).fill('Acme Labs');
    await agreement.check();
    await visit.page.getByRole('button', { name: 'Create organization', exact: true }).click();
    const destination = new URL('/', localOrigin);
    await visit.page.waitForURL(destination.href);
    assert.equal(visit.page.url(), destination.href);
    const organization = await run.workos.organizations.getOrganizationByExternalId(personalExternalId(run.settings.clientId, user.id));
    run.recordFixture('organization', organization.id);
    const acceptedFields: Readonly<Record<string, string>> = { ...originalForm.fields, organization_name: 'Acme Labs', agreement: 'accepted' };
    return { ...visit, user, organization, acceptedFields };
  });

  describe('Hosted live gate: organization creation and native MCP handoff', () => {
    // The test-only site takes the fixed port at once, so that no other run can take it between the two sites.
    before(async () => {
      await previous.stopSite();
      await run.site();
    });
    after(() => run.end());

    test('Given a verified new Staging user without memberships, when the user names Acme Labs and accepts the unchecked test authority agreement, then the saved record has ten exact fields, access is Admin, and a real MCP client fetches a public page with a token for that organization', options, async (t) => {
      const { user, organization, page } = await activated();
      const record = organization.metadata;
      assert.deepEqual(Object.keys(record).toSorted(), ['schema', 'subject', 'authority_accepted_at', 'documents_version', 'terms_version', 'terms_sha256', 'notice_version', 'notice_sha256', 'agreement_version', 'agreement_sha256'].toSorted());
      assert.deepEqual(record, { schema: 'thermus-signup-v2', subject: user.id, authority_accepted_at: record.authority_accepted_at, documents_version: signupDocuments.version, terms_version: signupDocuments.terms.version, terms_sha256: signupDocuments.terms.sha256, notice_version: signupDocuments.notice.version, notice_sha256: signupDocuments.notice.sha256, agreement_version: signupDocuments.agreement.version, agreement_sha256: createHash('sha256').update(signupDocuments.agreement.text).digest('hex') });
      assert.equal(new Date(record.authority_accepted_at).toISOString(), record.authority_accepted_at);
      assert.equal(organization.name, 'Acme Labs');
      assert.deepEqual(organization.domains, []);
      const memberships = await (await run.workos.userManagement.listOrganizationMemberships({ userId: user.id })).autoPagination();
      assert.equal(memberships.length, 1);
      assert.equal(memberships[0]?.organizationId, organization.id);
      assert.equal(memberships[0]?.status, 'active');
      assert.equal(memberships[0]?.directoryManaged, false);
      assert.deepEqual(memberships[0]?.roles?.map(({ slug }) => slug), ['admin']);
      await page.getByRole('heading', { name: 'Connect your MCP client' }).waitFor();
      await page.getByText('Workspace: Acme Labs', { exact: true }).waitFor();
      await page.getByText('Free access. No card is required and there is no automatic charge.', { exact: true }).waitFor();
      await page.getByText(`MCP endpoint: ${localOrigin}/mcp`, { exact: true }).waitFor();
      const agent = page.getByRole('combobox', { name: 'Your AI agent', exact: true });
      assert.equal(await agent.inputValue(), 'claude-code');
      await agent.selectOption('codex');
      await page.getByText(`codex mcp add thermus --url '${localOrigin}/mcp'`, { exact: true }).waitFor();
      await page.getByText('Sign in to Thermus in your browser. Choose the intended workspace. Approve the connection.', { exact: true }).waitFor();
      assert.equal((await sessionJson(page)).organizationId, organization.id);
      const { oauthApplication } = await run.fixtures();
      const grant = await authorizeWithConnect(run, { user, organizationName: organization.name, clientId: oauthApplication.clientId });
      assert.equal(grant.stateMatches, true);
      assert.equal(readToken(grant.tokens.accessToken).claims.org_id, organization.id);
      await fetchPage(await connectClient(t, run, grant.tokens.accessToken), run, { subject: user.id, organizationId: organization.id });
    });

    test('Given an activated user with a second User workspace, when the browser selects B while an MCP token stays in A, then revoking A denies that same token and repeat activation cannot restore A, while browser B and a fresh B token still work', options, async (t) => {
      const { user, organization, page, acceptedFields } = await activated();
      const { organizationB, oauthApplication } = await run.fixtures();
      await run.workos.userManagement.createOrganizationMembership({ userId: user.id, organizationId: organizationB.id, roleSlugs: ['user'] });
      const grantA = await authorizeWithConnect(run, { user, organizationName: organization.name, clientId: oauthApplication.clientId });
      const tokenA = grantA.tokens.accessToken;
      assert.equal(readToken(tokenA).claims.org_id, organization.id);
      const forms = formsIn((await serverGet(page, 'organizations')).body);
      assert.equal((await serverPost(page, 'organizations/select', { fields: formLabelled(forms, organizationB.name).fields })).status, 303);
      assert.equal((await sessionJson(page)).organizationId, organizationB.id);
      const clientA = await connectClient(t, run, tokenA);
      await fetchPage(clientA, run, { subject: user.id, organizationId: organization.id });
      const memberships = await (await run.workos.userManagement.listOrganizationMemberships({ userId: user.id, organizationId: organization.id })).autoPagination();
      assert.equal(memberships.length, 1);
      const membership = memberships[0];
      assert.ok(membership);
      await run.workos.userManagement.deactivateOrganizationMembership(membership.id);
      await assert.rejects(clientA.listTools(), (error: unknown) => error instanceof SdkHttpError && error.status === 403);
      assert.equal(readToken(tokenA).claims.org_id, organization.id);
      const signup = await serverGet(page, 'signup');
      assert.equal(formsIn(signup.body).some(({ action }) => action === '/signup'), false);
      const csrfToken = (await sessionJson(page)).csrfToken;
      assert.equal(csrfToken, acceptedFields.csrf_token, 'Organization selection must retain the original agreement form token.');
      assert.equal((await serverPost(page, 'signup', { fields: acceptedFields })).status, 409);
      const retained = await run.workos.userManagement.getOrganizationMembership(membership.id);
      assert.equal(retained.status, 'inactive');
      assert.equal((await sessionJson(page)).organizationId, organizationB.id);
      assert.equal((await serverGet(page, 'portal/access')).status, 200);
      const grantB = await authorizeWithConnect(run, { user, organizationName: organizationB.name, clientId: oauthApplication.clientId });
      assert.equal(readToken(grantB.tokens.accessToken).claims.org_id, organizationB.id);
      await fetchPage(await connectClient(t, run, grantB.tokens.accessToken), run, { subject: user.id, organizationId: organizationB.id });
    });
  });
}
