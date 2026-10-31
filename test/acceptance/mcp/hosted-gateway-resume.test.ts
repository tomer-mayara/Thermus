import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gatewayOrganization } from '../../support/in-process/hosted-gateway-site.ts';
import { openHostedResumeSite } from '../../support/in-process/hosted-resume-site.ts';
import { fetchCall, tenantMarkdown } from './fixtures/gateway-calls.ts';

// SO-10 of the self on-boarding plan: the resume of a suspended tenant at the next MCP call, through the Render API
// (plan section 4.2). The site is the control plane of hosted-gateway.test.ts as app composes it with
// MCP_TENANTS_ENABLED on: the gateway parts, the provisioner loop, and the resume operation on the Render adapter,
// against the fake of the Render API and one fake of the tenant registry. The service of the suspended tenant has the
// address of the fake tenant upstream.

const resuming = { status: 503, retryAfter: '60', error: 'temporarily_unavailable', description: 'Your workspace is restarting after a pause. Try again in a minute.' };
const limitedResume = { status: 429, headers: { 'Retry-After': '30', 'Ratelimit-Limit': '10', 'Ratelimit-Remaining': '0', 'Ratelimit-Reset': '30' }, body: { message: 'Too Many Requests' } };

test('Given a suspended tenant, when a call arrives, then the gateway asks Render to resume it one time and answers 503 with Retry-After: 60 until the tenant is live, and then the next call reaches the tenant', { timeout: 30_000 }, async (t) => {
  const site = await openHostedResumeSite(t);
  const service = site.suspendedTenant();
  // The provisioner waits for the deploy list until the test has seen the answers while the tenant deploys.
  const deploys = site.render.hold('list deploys');
  const token = await site.token();

  const atTheCall = await site.refusal({ method: 'tools/call', token, params: fetchCall });
  const stateAfterTheCall = site.table.stateOf(gatewayOrganization);
  site.advance(10_000);
  const whileDeploying = await site.refusal({ method: 'tools/call', token, params: fetchCall });
  deploys.release();
  await site.untilState('live');
  site.advance(10_000);
  const result = await site.toolResult({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual(atTheCall, resuming);
  assert.equal(stateAfterTheCall, 'deploying');
  assert.deepEqual(whileDeploying, resuming);
  assert.deepEqual(site.render.requestsOf('resume service').map((request) => request.path), [`/services/${service.id}/resume`]);
  assert.equal(service.suspended, false);
  assert.equal(service.deploys[0]?.trigger, 'service_resumed', 'The row went live on the deploy of the resume');
  assert.deepEqual(result.content, [{ type: 'text', text: tenantMarkdown }]);
  assert.deepEqual(site.tenant.requests.filter((request) => request.rpcMethod === 'tools/call').length, 1);
});

test('Given a suspended tenant, when calls arrive at the same time, then Render gets one resume request, and each client gets 503 with Retry-After: 60', { timeout: 30_000 }, async (t) => {
  const site = await openHostedResumeSite(t);
  const service = site.suspendedTenant();
  const resume = site.render.hold('resume service');
  const token = await site.token();

  const answers = [1, 2, 3].map(() => site.refusal({ method: 'tools/call', token, params: fetchCall }));
  await site.untilRenderRequests('resume service', 1);
  resume.release();
  const refusals = await Promise.all(answers);

  assert.deepEqual(refusals, [resuming, resuming, resuming]);
  assert.deepEqual(site.render.requestsOf('resume service').map((request) => request.path), [`/services/${service.id}/resume`]);
  assert.equal(site.table.stateOf(gatewayOrganization), 'deploying');
});

test('Given a resume that Render limits with 429, when a call arrives, then the client gets 503 with Retry-After: 60, the operator gets one report, the row stays suspended, and the next call resumes the tenant', { timeout: 30_000 }, async (t) => {
  const site = await openHostedResumeSite(t);
  site.suspendedTenant();
  site.render.failNext('resume service', limitedResume);
  const token = await site.token();

  const limited = await site.refusal({ method: 'tools/call', token, params: fetchCall });
  const stateAfterTheLimit = site.table.stateOf(gatewayOrganization);
  const next = await site.refusal({ method: 'tools/call', token, params: fetchCall });

  assert.deepEqual([limited, next], [resuming, resuming]);
  assert.equal(stateAfterTheLimit, 'suspended');
  assert.equal(site.render.requestsOf('resume service').length, 2);
  assert.equal(site.table.stateOf(gatewayOrganization), 'deploying');
  const reports = site.log.lines.filter((line) => line.startsWith('ERROR '));
  assert.equal(reports.length, 1, site.log.lines.join('\n'));
  assert.match(reports[0] ?? '', /^ERROR MCP gateway refusal: .*"reason":"resuming".*"resume":"failed".*"resumeFailure":"The platform did not take the resume: the platform limits the calls of the service for 30 s"/);
});
