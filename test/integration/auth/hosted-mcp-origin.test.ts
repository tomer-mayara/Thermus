import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeHostedApplication } from '../../../src/application.ts';
import { BillingFree } from '../../../src/billing/billing-free.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { BrowserSessionDouble } from '../../support/doubles/auth/browser-session-double.ts';
import { IdentityVerifierSpy } from '../../support/doubles/auth/identity-verifier-spy.ts';
import { MembershipDirectoryDouble } from '../../support/doubles/organizations/membership-directory-double.ts';
import { mcpRequest } from '../../support/drivers/mcp/mcp-http-request.ts';
import { hostedConfig } from '../../support/fixtures/hosted-config.ts';

test('Given hosted composition with an MCP identity verifier, when foreign Origin requests carry bearer credentials, then all methods get 403 without identity, session, or membership work; accepted origins retain token verification', async (t) => {
  const verifier = new IdentityVerifierSpy();
  const session = new BrowserSessionDouble(new Map());
  const directory = new MembershipDirectoryDouble('hosted-provider-double', []);
  const mcp = new MCPServer({
    auth: { verifier, accessResolver: directory, resourceMetadataUrl: hostedConfig.resourceMetadataUrl, expectedResource: new URL(hostedConfig.mcpResourceUrl) },
    reportFailure: () => {},
  });
  const application = composeHostedApplication(hostedConfig, { session, accessResolver: directory, organizations: directory, mcp }, {
    reportFailure: () => {}, changeRecords: { record: () => {} }, billing: new BillingFree(),
  });
  t.after(() => application.close());

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = await application.handle(new Request(hostedConfig.mcpResourceUrl, {
      method, headers: { Origin: 'https://evil.example', Authorization: 'Bearer rejected-token', Cookie: 'session=ann' },
    }));
    assert.equal(response.status, 403, method);
  }

  assert.deepEqual(verifier.calls, []);
  assert.deepEqual(session.calls, []);
  assert.deepEqual(directory.calls, []);

  const acceptedOrigins: readonly Record<string, string>[] = [{}, { Origin: 'https://thermus.example' }];
  for (const headers of acceptedOrigins) {
    const response = await application.handle(mcpRequest({ url: hostedConfig.mcpResourceUrl, method: 'tools/list', token: 'rejected-token', headers }));
    assert.equal(response.status, 401);
  }
  assert.deepEqual(verifier.calls, ['rejected-token', 'rejected-token']);
  assert.deepEqual(session.calls, []);
  assert.deepEqual(directory.calls, []);
});
