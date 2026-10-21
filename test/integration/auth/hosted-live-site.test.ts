import assert from 'node:assert/strict';
import { text } from 'node:stream/consumers';
import { describe, test } from 'node:test';
import '../../support/processes/use-hosted-portal-fixture.ts';
import { signupDocuments } from '../../support/fixtures/signup-documents.ts';
import { sendHttpsRequest } from '../../support/drivers/browser/https-client.ts';
import { LocalHttpsSite, selfSignedCertificate } from '../../support/hosted-live/local-https-site.ts';
import { localOrigin } from '../../support/hosted-live/settings.ts';
import { lightpandaStub } from '../../support/processes/module-paths.ts';
import { httpsSettings as settings, temporaryDirectory } from './fixtures/https-site-fixtures.ts';
import { describeHttpsMcp } from './hosted-live-site/mcp.ts';

// The placeholder settings reach no WorkOS environment. The hosted composition makes no WorkOS call when it starts.
const caseOptions = { timeout: 10_000 };
const front = new URL(localOrigin);

interface FrontAnswer {
  readonly status: number;
  readonly body: string;
}

async function frontGet(path: string, ca: Buffer): Promise<FrontAnswer> {
  const call = await sendHttpsRequest(new Request(new URL(path, front)), ca);
  const incoming = await call.response;
  return { status: incoming.statusCode ?? 0, body: await text(incoming) };
}

describe('Local HTTPS site of the hosted live gate (test support) with the real HTTP server', () => {
  test('Given valid placeholder WorkOS settings and the default hosted gate composition, when the local HTTPS site starts with its trusted rules fixture, then it serves the portal and keeps account and MCP requests without credentials protected', caseOptions, async (t) => {
    const certificate = await selfSignedCertificate(await temporaryDirectory(t));
    const site = await LocalHttpsSite.start(settings, { rendererExecutable: lightpandaStub, certificate });
    t.after(() => site.close());

    const portal = await frontGet('/', certificate.cert);
    const health = await frontGet('/healthz', certificate.cert);
    const signup = await frontGet('/signup', certificate.cert);
    const missingAsset = await frontGet('/assets/missing.js', certificate.cert);
    const account = await frontGet('/account', certificate.cert);
    const mcp = await frontGet('/mcp', certificate.cert);

    assert.equal(portal.status, 200);
    assert.match(portal.body, /Thermus hosted portal fixture/);
    assert.equal(health.status, 200);
    assert.equal(signup.status, 200);
    assert.match(signup.body, /Activation is closed/);
    assert.equal(missingAsset.status, 404);
    assert.equal(account.status, 401);
    assert.match(account.body, /Sign-in required/);
    assert.equal(mcp.status, 401);
    assert.ok(site.log.lines.some((line) => line.includes('Hosted authentication uses WorkOS')));
    await site.close();
  });

  test('Given the live test composition with TEST ONLY documents, when an unsigned visitor opens signup, then it serves the test notice and real portal without a WorkOS call', caseOptions, async (t) => {
    const certificate = await selfSignedCertificate(await temporaryDirectory(t));
    const site = await LocalHttpsSite.start(settings, { rendererExecutable: lightpandaStub, certificate, signupDocuments });
    t.after(() => site.close());

    const signup = await frontGet('/signup', certificate.cert);
    const portal = await frontGet('/', certificate.cert);

    assert.equal(signup.status, 200);
    assert.ok(signup.body.includes(signupDocuments.notice.text));
    assert.match(signup.body, /Sign in/);
    assert.equal(portal.status, 200);
    assert.match(portal.body, /Thermus hosted portal fixture/);
  });
});
describeHttpsMcp();
