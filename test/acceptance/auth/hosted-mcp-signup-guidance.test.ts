import assert from 'node:assert/strict';
import { describe, test, type TestContext } from 'node:test';
import { loadDeploymentConfig } from '../../../src/config/deployment-config.ts';
import { composeWorkOSApplication } from '../../../src/hosted-workos-application.ts';
import { startHttpServer } from '../../../src/http/server.ts';
import { listenerTransport } from '../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest, toolJson } from '../../support/drivers/mcp/mcp-http-request.ts';
import type { WorkOSServerSite } from '../../support/dsl/workos-sign-in.ts';
import { ContextReportToolSpy, type ContextReport } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import { WorkOSFake, type FakeUser } from '../../support/doubles/workos/workos-fake.ts';

const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example/team/' }, 'http');
const user: FakeUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };

async function openSite(t: TestContext): Promise<WorkOSServerSite & { tools: ContextReportToolSpy }> {
  const world = await WorkOSFake.start(t, config.publicBaseUrl, ['org_USER', 'org_ADMIN', 'org_INACTIVE', 'org_MEMBER']);
  world.memberships = [
    { userId: user.id, organizationId: 'org_USER', roles: ['user'] },
    { userId: user.id, organizationId: 'org_ADMIN', roles: ['admin'] },
    { userId: user.id, organizationId: 'org_INACTIVE', roles: ['user'], status: 'inactive' },
    { userId: user.id, organizationId: 'org_MEMBER', roles: [] },
  ];
  const tools = new ContextReportToolSpy();
  const logger = { info: (_message: string): void => {}, error: (_message: string): void => {} };
  const application = await composeWorkOSApplication(config, world.connection(), { logger, buildServer: tools.buildServer });
  const server = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger });
  t.after(async () => {
    await server.close();
    await application.close();
  });
  return { world, tools, transport: listenerTransport(server.url), publicBaseUrl: config.publicBaseUrl };
}

function callTool(site: WorkOSServerSite, token?: string): Promise<Response> {
  return site.transport(mcpRequest({
    url: config.mcpResourceUrl,
    method: 'tools/call',
    ...(token === undefined ? {} : { token }),
    params: { name: ContextReportToolSpy.reportTool, arguments: {} },
  }));
}

describe('Hosted MCP access guidance', () => {
  test('Given an authenticated MCP client without User access in its token workspace, when it calls a tool, then the denial points to signup and reauthorization without granting access; a token for its User workspace can call the tool', async (t) => {
    const site = await openSite(t);

    for (const organizationId of [undefined, 'org_ADMIN', 'org_INACTIVE', 'org_MEMBER']) {
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
