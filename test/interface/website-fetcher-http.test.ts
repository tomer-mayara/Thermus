import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { WebsiteFetchHttpError } from '../../src/website-fetcher/website-fetcher.ts';
import { permitIPv4Fixture } from '../support/network-fixture.ts';

describe('WebsiteFetcherLightpanda HTTP contract', () => {
  const server = createServer((request, response) => {
    const parts = (request.url ?? '/').split('/');
    if (parts[1] === 'redirect') {
      response.writeHead(302, { location: `/next/${parts[2]}` });
      response.end();
      return;
    }
    if (parts[1] === 'next') {
      response.writeHead(307, { location: `/status/${parts[2]}` });
      response.end();
      return;
    }
    const status = Number(parts[2]);
    response.writeHead(status, { 'content-type': 'text/html' });
    response.end(`<html><body>HTTP ${status}<script>document.body.append(' rendered');</script></body></html>`);
  });
  let origin: string;

  before(async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    origin = `http://localhost:${address.port}`;
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  for (const route of ['status', 'redirect']) {
    test(`returns rendered HTML for ${route} ending in HTTP 200`, async (context) => {
      permitIPv4Fixture(context);
      const requestedUrl = `${origin}/${route}/200`;
      const { html, requestedUrl: actualRequestedUrl, finalUrl } = await new WebsiteFetcherLightpanda().fetchURL(requestedUrl);
      assert.equal(actualRequestedUrl, requestedUrl);
      assert.equal(finalUrl, `${origin}/status/200`);
      assert.match(html, /<html[\s>]/i);
      assert.match(html, /HTTP 200/);
      assert.match(html, / rendered<\/body>/);
    });

    for (const status of [403, 404, 429, 500]) {
      test(`rejects ${route} ending in HTTP ${status}`, async (context) => {
        permitIPv4Fixture(context);
        await assert.rejects(new WebsiteFetcherLightpanda().fetchURL(`${origin}/${route}/${status}`), (error) => {
          assert.ok(error instanceof WebsiteFetchHttpError);
          assert.equal(error.kind, 'http');
          assert.equal(error.status, status);
          assert.ok(error.cause instanceof Error);
          return true;
        });
      });
    }
  }
});
