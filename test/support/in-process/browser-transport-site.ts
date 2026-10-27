import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { BrowserTransport } from '../drivers/browser/hosted-browser.ts';
import { selfSignedCertificate } from '../hosted-live/local-https-site.ts';

// Chromium resolves the public hostname to this TLS front, including after redirects.
export async function serveBrowserTransport(t: TestContext, transport: BrowserTransport): Promise<number> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-browser-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const failures: unknown[] = [];
  const server = createServer(await selfSignedCertificate(directory), async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value === undefined) continue;
        for (const entry of Array.isArray(value) ? value : [value]) headers.append(name, entry);
      }
      const response = await transport(new Request(new URL(incoming.url ?? '/', 'https://thermus.example'), {
        method: incoming.method,
        headers,
        ...(body.length === 0 ? {} : { body }),
      }));
      outgoing.writeHead(response.status, {
        ...Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie')),
        'set-cookie': response.headers.getSetCookie(),
      });
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      failures.push(error);
      outgoing.destroy(error instanceof Error ? error : new Error('Browser transport failed', { cause: error }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error === undefined ? resolve() : reject(error)));
    assert.deepEqual(failures, [], 'The browser TLS front must complete each exchange');
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('The browser TLS front has no port');
  return address.port;
}
