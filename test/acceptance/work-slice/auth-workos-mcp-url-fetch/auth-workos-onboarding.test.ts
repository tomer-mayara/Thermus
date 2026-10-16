import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { composeWorkOSApplication } from '../../../../src/hosted-workos-application.ts';
import { loadDeploymentConfig } from '../../../../src/config/deployment-config.ts';
import { listenerTransport } from '../../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest, rpcResult } from '../../../support/drivers/mcp/mcp-http-request.ts';
import { startHttpServer } from '../../../../src/http/server.ts';
import { RendererProcessDouble } from '../../../support/doubles/website-fetcher/renderer-process-double.ts';
import { WorkOSFake } from '../../../support/doubles/workos/workos-fake.ts';
import { signInThroughServer } from '../../../support/dsl/workos-sign-in.ts';
import { trustedAdRulesFile } from '../../../support/fixtures/ad-rules.ts';
import { composeWorkSliceApplication } from './auth-workos-mcp-url-fetch.ts';

const organizationId = 'org_01SLICE';
const user = { id: 'user_NEW', email: 'new@thermus.ai', firstName: 'New' };
const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example' }, 'http');

test('Given a new verified thermus.ai Google user without a membership, when browser sign-in completes, then User access and the organization session are automatic, and a separate organization Connect token can fetch a validated URL', async (t) => {
  const renderer = RendererProcessDouble.install(t);
  const url = 'https://news.example/story';
  renderer.serve(url, { finalUrl: url, html: '<html><head><title>Story</title></head><body><main><h1>Automatic access</h1><p>The new member can read this article through the authenticated fetch tool.</p></main></body></html>' });
  const world = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
  world.users = [user];
  world.authenticationMethod = 'GoogleOAuth';
  const application = await composeWorkSliceApplication({ config, connection: world.connection(), environment: {
    THERMUS_SLICE_ORGANIZATION_ID: organizationId, AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/test/lightpanda',
  } }, { info: () => {}, error: () => {} });
  const listener = await startHttpServer(application.handle, { listen: { host: '127.0.0.1', port: 0 }, publicBaseUrl: config.publicBaseUrl, logger: { error: () => {} } });
  t.after(() => application.close(listener.close()));
  const transport = listenerTransport(listener.url);
  const { browser } = await signInThroughServer({ world, transport, publicBaseUrl: config.publicBaseUrl }, user);
  const session = await browser.open('session', { Accept: 'application/json' });
  const access = await browser.open('portal/access', { Accept: 'application/json' });
  assert.equal(JSON.parse(session.body).organizationId, organizationId);
  assert.equal(JSON.parse(session.body).mfaCompleted, false);
  assert.equal(access.status, 200);
  assert.deepEqual(JSON.parse(access.body), { organizationId, roles: ['user'], plan: 'free', mcpUrl: config.mcpResourceUrl });
  const response = await transport(mcpRequest({ url: config.mcpResourceUrl, token: await world.connectToken(user, { org_id: organizationId }), method: 'tools/call', params: {
    name: 'getURLAsMarkdown', arguments: { url, reason: 'Read the onboarding article' },
  } }));
  assert.equal(response.status, 200);
  const result = await rpcResult(response) as CallToolResult;
  assert.equal(result.isError === true, false);
  assert.match(JSON.stringify(result.content), /Automatic access/);
  const noOrganization = await transport(mcpRequest({ url: config.mcpResourceUrl, token: await world.connectToken(user), method: 'tools/list' }));
  assert.equal(noOrganization.status, 403);
});

test('Given the production hosted composition without an onboarding policy and a new verified thermus.ai Google user, when browser sign-in completes, then no membership or product access is granted', async (t) => {
  const world = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
  world.users = [user];
  world.authenticationMethod = 'GoogleOAuth';
  const application = await composeWorkOSApplication(config, world.connection(), { logger: { info: () => {}, error: () => {} } });
  t.after(() => application.close());
  const { browser } = await signInThroughServer({ world, transport: application.handle, publicBaseUrl: config.publicBaseUrl }, user);
  const session = await browser.open('session', { Accept: 'application/json' });
  const access = await browser.open('portal/access', { Accept: 'application/json' });
  assert.equal(JSON.parse(session.body).signedIn, true);
  assert.equal(JSON.parse(session.body).organizationId, undefined);
  assert.equal(access.status, 403);
  assert.deepEqual(world.memberships, []);
  assert.equal(world.fake.takeRequests().some(({ method, path }) => method === 'POST' && path === '/user_management/organization_memberships'), false);
});

test('Given slice settings without an organization ID, when the slice is composed, then it fails before sign-in can enroll any user', async (t) => {
  const world = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
  await assert.rejects(composeWorkSliceApplication({ config, connection: world.connection(), environment: {
    AD_RULES_FILE: trustedAdRulesFile, LIGHTPANDA_BIN: '/test/lightpanda',
  } }, { info: () => {}, error: () => {} }), /THERMUS_SLICE_ORGANIZATION_ID/);
  assert.deepEqual(world.fake.takeRequests(), []);
});
