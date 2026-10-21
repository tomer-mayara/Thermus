import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OperatorLogSpy } from '../../support/doubles/application/operator-log-spy.ts';
import { ContextReportToolSpy } from '../../support/doubles/mcp/context-report-tool-spy.ts';
import type { FakeUser, WorkOSFake } from '../../support/doubles/workos/workos-fake.ts';
import { HostedBrowser } from '../../support/drivers/browser/hosted-browser.ts';
import { mcpRequest, rpcResult } from '../../support/drivers/mcp/mcp-http-request.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { hostedConfig, hostedRootConfig } from '../../support/fixtures/hosted-config.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { serveWorkOSSite, type WorkOSSite } from '../../support/in-process/workos-site.ts';

const acme = 'org_01ACME';
const ada: FakeUser = { id: 'user_01ADA', email: 'ada@example.com', firstName: 'Ada' };
const ben: FakeUser = { id: 'user_01BEN', email: 'ben@example.com', firstName: 'Ben' };

function adaAsUser(world: WorkOSFake): void {
  world.memberships = [{ userId: ada.id, organizationId: acme, roles: ['user'] }];
}

async function listTools(site: WorkOSSite): Promise<Response> {
  const token = await site.world.connectToken(ada, { org_id: acme });
  return site.transport(mcpRequest({ url: hostedConfig.mcpResourceUrl, method: 'tools/list', token }));
}

describe('Hosted WorkOS site of the offline hosted WorkOS specifications', () => {
  test('Given a site with Acme, where Ada has User and Ben has only Admin, when server/discover reaches the MCP endpoint without a token and with the Connect token of each in Acme, then the answers are 401, 200, and 403, and the operator log of the site has no ERROR line', async (t) => {
    const site = await serveWorkOSSite(t, {
      organizations: [acme],
      setUp: (world) => {
        world.memberships = [
          { userId: ada.id, organizationId: acme, roles: ['user'] },
          { userId: ben.id, organizationId: acme, roles: ['admin'] },
        ];
      },
    });

    const statuses = [
      (await site.discover()).status,
      (await site.discover(await site.world.connectToken(ada, { org_id: acme }))).status,
      (await site.discover(await site.world.connectToken(ben, { org_id: acme }))).status,
    ];

    assert.deepEqual(statuses, [401, 200, 403]);
    assert.ok(site.log instanceof OperatorLogSpy);
    assert.ok(site.log.lines.every((line) => !line.startsWith('ERROR')), site.log.lines.join('\n'));
  });

  test('Given a site whose fake fails each membership read, when server/discover reaches the MCP endpoint with the Connect token of a User, then the answer is 500, and the operator log of the site has an ERROR line of the application', async (t) => {
    const site = await serveWorkOSSite(t, {
      organizations: [acme],
      setUp: (world) => {
        world.memberships = [{ userId: ada.id, organizationId: acme, roles: ['user'] }];
        world.membershipOutage = { status: 500, body: { message: 'Internal error' } };
      },
    });

    const answer = await site.discover(await site.world.connectToken(ada, { org_id: acme }));

    assert.equal(answer.status, 500);
    assert.ok(site.log.lines.some((line) => line.startsWith('ERROR ')), site.log.lines.join('\n'));
  });

  test('Given a site with a buildServer that gives a test-only tool and a site without a buildServer, when the Connect token of a User lists the tools at each MCP endpoint, then the first list has only that tool, and the second endpoint has no tool list and answers that the method is not found', async (t) => {
    const withTool = await listTools(await serveWorkOSSite(t, { organizations: [acme], buildServer: new ContextReportToolSpy().buildServer, setUp: adaAsUser }));
    const withoutTool = await listTools(await serveWorkOSSite(t, { organizations: [acme], setUp: adaAsUser }));

    assert.equal(withTool.status, 200);
    const { tools } = await rpcResult(withTool) as { tools: ReadonlyArray<{ name: string }> };
    assert.deepEqual(tools.map(({ name }) => name), [ContextReportToolSpy.reportTool]);
    assert.equal(withoutTool.status, 404);
    assert.deepEqual((await withoutTool.json() as { error: unknown }).error, { code: -32601, message: 'Method not found' });
  });

  test('Given a site with the Required MFA policy and a site without an MFA policy, when Ada signs in through each server with Password, then only the session of the first has the MFA evidence, because the fake gives its Optional policy to the second', async (t) => {
    const sites = [
      await serveWorkOSSite(t, { organizations: [acme], mfaPolicy: 'required', setUp: adaAsUser }),
      await serveWorkOSSite(t, { organizations: [acme], setUp: adaAsUser }),
    ];

    const evidence: unknown[] = [];
    for (const site of sites) {
      const { browser, callback } = await signInThroughServer(site, ada, acme);
      assert.equal(callback.status, 303, callback.body);
      const session = await browser.open('session', { Accept: 'application/json' });
      evidence.push((JSON.parse(session.body) as { readonly mfaCompleted?: unknown }).mfaCompleted);
    }

    assert.deepEqual(evidence, [true, false]);
  });

  test('Given a site with the signup fake and signup with the test documents, when a visitor opens the signup page, then the answer is 200 with the full notice, and the signup fake has no personal organization', async (t) => {
    const site = await serveWorkOSSite(t, { organizations: [acme], signupFake: true, signup: { enabled: true, documents: signupDocuments } });

    const answer = await new HostedBrowser(site.transport, site.publicBaseUrl).open('signup');

    assert.equal(answer.status, 200, answer.body);
    assert.ok(answer.body.includes(signupDocuments.notice.text), answer.body);
    assert.deepEqual(site.signupFake.organizations, []);
  });

  test('Given signup without approved documents, when the site starts, then serveWorkOSSite() rejects with the document error of the composition', async (t) => {
    await assert.rejects(serveWorkOSSite(t, { organizations: [acme], signup: { enabled: true } }), /document|bundle/i);
  });

  test('Given a site with the hosted configuration at the root of the host, when server/discover reaches its MCP endpoint without a token, then the site has the public base URL https://thermus.example/, and the answer is 401 with the resource metadata of the root', async (t) => {
    const site = await serveWorkOSSite(t, { config: hostedRootConfig, organizations: [acme] });

    const answer = await site.discover();

    assert.equal(site.publicBaseUrl, 'https://thermus.example/');
    assert.equal(answer.status, 401);
    assert.match(answer.headers.get('WWW-Authenticate') ?? '', /resource_metadata="https:\/\/thermus\.example\/\.well-known\/oauth-protected-resource\/mcp"/);
  });
});
