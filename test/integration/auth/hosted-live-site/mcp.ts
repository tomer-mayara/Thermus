import assert from 'node:assert/strict';
import { text } from 'node:stream/consumers';
import { describe, test } from 'node:test';
import { loadDeploymentConfig } from '../../../../src/config/deployment-config.ts';
import { fetchToolServers } from '../../../../src/fetch-tool.ts';
import { WorkOSFake } from '../../../support/doubles/workos/workos-fake.ts';
import { mcpRequest } from '../../../support/drivers/mcp/mcp-http-request.ts';
import { sendHttpsRequest } from '../../../support/drivers/browser/https-client.ts';
import { LocalHttpsSite, selfSignedCertificate } from '../../../support/hosted-live/local-https-site.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import { composeApplicationWithWorkOSFake } from '../../../support/in-process/workos-site.ts';
import { beforeDeadline, temporaryDirectory, writePortalBuild } from '../fixtures/https-site-fixtures.ts';

const organizationId = 'org_01HTTPS';
const ada = { id: 'user_01ADA', email: 'ada@thermus.ai', firstName: 'Ada' };
const config = loadDeploymentConfig({ DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: localOrigin }, 'http');
const requestedUrl = 'https://example.com/story';
const params = { name: 'getURLAsMarkdown', arguments: { url: requestedUrl, reason: 'Read the HTTPS story' } };

export function describeHttpsMcp(): void {
  describe('Authenticated MCP POST through the local HTTPS front', () => {
    test('Given a WorkOS User grant and Connect token, when an HTTPS MCP POST calls the fetch tool, then the verified identity and body reach the tool and the client receives its result; an invalid token or removed grant starts no work', { timeout: 10_000 }, async (t) => {
      const fake = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
      fake.memberships = [{ userId: ada.id, organizationId, roles: ['user'] }];
      const token = await fake.connectToken(ada, { org_id: organizationId });
      const calls: unknown[] = [];
      const certificate = await selfSignedCertificate(await temporaryDirectory(t));
      const site = await LocalHttpsSite.start(fake.settings, {
        portalBuild: await writePortalBuild(t), certificate,
        application: (logger) => composeApplicationWithWorkOSFake(config, fake, {
          logger, buildServer: fetchToolServers(async (url, context) => {
            calls.push({ url, subject: context.user.subject, tenantId: context.tenantId });
            return '# HTTPS story';
          }, logger),
        }),
      });
      t.after(() => site.close());
      const valid = await sendHttpsRequest(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token, params }), certificate.cert);
      const answer = await valid.response;
      assert.equal(answer.statusCode, 200);
      const message = JSON.parse(await text(answer)) as { result: { content: unknown[] } };
      assert.deepEqual(message.result.content, [{ type: 'text', text: '# HTTPS story' }]);
      assert.deepEqual(calls, [{ url: requestedUrl, subject: ada.id, tenantId: `workos:${fake.settings.clientId}:${organizationId}` }]);

      const invalid = await sendHttpsRequest(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token: 'wrong-token', params }), certificate.cert);
      const refused = await invalid.response;
      assert.equal(refused.statusCode, 401);
      assert.match(String(refused.headers['www-authenticate']), /resource_metadata=/);
      await text(refused);
      fake.setRoles(ada, organizationId, []);
      const revoked = await sendHttpsRequest(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token, params }), certificate.cert);
      const denied = await revoked.response;
      assert.equal(denied.statusCode, 403);
      await text(denied);
      assert.equal(calls.length, 1);
    });

    test('Given an authenticated MCP POST with active fetch work, when its HTTPS client disconnects, then the operation observes cancellation and records no success', { timeout: 10_000 }, async (t) => {
      const fake = await WorkOSFake.start(t, config.publicBaseUrl, [organizationId]);
      fake.memberships = [{ userId: ada.id, organizationId, roles: ['user'] }];
      const token = await fake.connectToken(ada, { org_id: organizationId });
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const records: string[] = [];
      const certificate = await selfSignedCertificate(await temporaryDirectory(t));
      const site = await LocalHttpsSite.start(fake.settings, {
        portalBuild: await writePortalBuild(t), certificate,
        application: (logger) => composeApplicationWithWorkOSFake(config, fake, {
          logger, buildServer: fetchToolServers(async (_url, _context, signal) => {
            signal.addEventListener('abort', () => aborted.resolve(), { once: true });
            started.resolve();
            await Promise.race([aborted.promise, release.promise]);
            return 'A late result';
          }, { info: (record) => records.push(record), error: (record) => records.push(record) }),
        }),
      });
      t.after(() => site.close());
      const call = await sendHttpsRequest(mcpRequest({ url: config.mcpResourceUrl, method: 'tools/call', token, params }), certificate.cert);
      const disconnected = assert.rejects(call.response);
      try {
        await started.promise;
        call.request.destroy(new Error('The MCP client disconnected'));
        await disconnected;
        await beforeDeadline(aborted.promise);
        await site.close();
        assert.deepEqual(records.map((record) => JSON.parse(record).status), ['cancelled']);
      } finally {
        release.resolve();
      }
    });
  });
}
