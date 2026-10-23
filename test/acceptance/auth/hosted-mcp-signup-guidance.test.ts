import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { mcpRequest, toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import { ContextReportToolSpy, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import type { FakeUser } from '../../support/doubles/workos/workos-fake.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';
import { serveWorkOSSite, type WorkOSServerSite, type WorkOSSite } from '../../support/in-process/workos-site.ts';

const user: FakeUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };

async function openSite(t: TestContext): Promise<WorkOSSite & { tools: ContextReportToolSpy }> {
  const tools = new ContextReportToolSpy();
  const site = await serveWorkOSSite(t, {
    organizations: ['org_USER', 'org_NO_GRANT', 'org_INACTIVE', 'org_MEMBER'],
    buildServer: tools.buildServer,
    setUp: (world) => {
      world.memberships = [
        { userId: user.id, organizationId: 'org_USER', roles: ['user'] },
        { userId: user.id, organizationId: 'org_NO_GRANT', roles: ['member'] },
        { userId: user.id, organizationId: 'org_INACTIVE', roles: ['user'], status: 'inactive' },
        { userId: user.id, organizationId: 'org_MEMBER', roles: [] },
      ];
    },
  });
  return { ...site, tools };
}

function callTool(site: WorkOSServerSite, token?: string): Promise<Response> {
  return site.transport(mcpRequest({
    url: hostedConfig.mcpResourceUrl,
    method: 'tools/call',
    ...(token === undefined ? {} : { token }),
    params: { name: ContextReportToolSpy.reportTool, arguments: {} },
  }));
}

describe('Hosted MCP access guidance', () => {
  test('Given an authenticated MCP client without current product permission in its token workspace, when it calls a tool, then denial points to signup and reauthorization without granting access; an authorized token for another workspace still calls the tool', async (t) => {
    const site = await openSite(t);

    for (const organizationId of [undefined, 'org_NO_GRANT', 'org_INACTIVE', 'org_MEMBER']) {
      const token = await site.world.connectToken(user, organizationId === undefined ? {} : { org_id: organizationId });
      const response = await callTool(site, token);
      const body = await response.json() as { error: string; error_description: string };

      assert.equal(response.status, 403);
      assert.equal(body.error, 'access_denied');
      assert.ok(body.error_description.includes('https://thermus.example/team/signup'), body.error_description);
      assert.match(body.error_description, /reauthoriz/i);
      assert.match(body.error_description, /workspace/i);
      assert.equal(response.headers.get('WWW-Authenticate'), null);
    }
    assert.deepEqual(site.tools.contexts, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);

    const token = await site.world.connectToken(user, { org_id: 'org_USER' });
    const report = await toolJson<ContextReport>(await callTool(site, token));

    assert.equal(report.context.organizationId, 'org_USER');
    assert.equal(site.tools.contexts.length, 1);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });

  test('Given hosted signup guidance, when a client has no valid token or WorkOS cannot read its membership, then the response remains an authentication challenge or server failure and no tool or provider write runs', async (t) => {
    const site = await openSite(t);
    for (const token of [undefined, 'not-a-token']) {
      const response = await callTool(site, token);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('WWW-Authenticate') ?? '', /Bearer/);
      assert.ok(!(await response.text()).includes('/signup'));
    }
    site.world.membershipOutage = { status: 500, body: { message: 'Internal error' } };
    const token = await site.world.connectToken(user, { org_id: 'org_USER' });
    const response = await callTool(site, token);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error', error_description: 'Internal Server Error' });
    assert.deepEqual(site.tools.contexts, []);
    assert.deepEqual(site.world.fake.takeRequests().filter(({ method }) => method !== 'GET'), []);
  });
});
