import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Server } from 'node:net';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { LocalHttpsSite } from '../../support/hosted-live/local-https-site.ts';
import type { HostedLiveSettings } from '../../support/hosted-live/settings.ts';
import { workOSSettings } from '../../support/hosted-placeholder.ts';
import { serverHandles } from '../../unit/http/fixtures/http-server-fixtures.ts';

// The placeholder settings reach no WorkOS environment. The hosted composition makes no WorkOS call when it starts.
const settings: HostedLiveSettings = {
  apiKey: workOSSettings.WORKOS_API_KEY,
  clientId: workOSSettings.WORKOS_CLIENT_ID,
  authkitIssuer: workOSSettings.WORKOS_AUTHKIT_ISSUER,
};
const caseOptions = { timeout: 10_000 };

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-hosted-live-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writePortalBuild(t: TestContext): Promise<string> {
  const directory = await temporaryDirectory(t);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Portal</title>');
  await writeFile(join(directory, 'assets', 'app.js'), 'document.body.dataset.portal = "ready";\n');
  return directory;
}

// Node finds a command through the PATH of process.env when it starts the command. Without a PATH, Node uses a
// default path, and that path can contain OpenSSL. Thus the test sets PATH to an empty directory.
async function withPath<T>(t: TestContext, path: string, action: () => Promise<T>): Promise<T> {
  const original = process.env.PATH;
  const restore = (): void => {
    if (original === undefined) delete process.env.PATH;
    else process.env.PATH = original;
  };
  t.after(restore);
  process.env.PATH = path;
  try {
    return await action();
  } finally {
    restore();
  }
}

// A regression that leaks a server would keep the test process alive after the failed assertion. The listen mock
// records each server, and the cleanup closes the servers that still listen, so that the file fails and exits.
function closeLeakedServersAfter(t: TestContext): void {
  const servers: Server[] = [];
  const listen = Server.prototype.listen;
  t.mock.method(Server.prototype, 'listen', function (this: Server, ...args: unknown[]): Server {
    servers.push(this);
    return Reflect.apply(listen, this, args) as Server;
  });
  t.after(async () => {
    for (const server of servers) {
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    }
  });
}

// Node removes the handle of a closed server one event loop turn after the close.
async function serverHandlesAfterClose(before: number): Promise<number> {
  const deadline = Date.now() + 2_000;
  while (serverHandles() > before && Date.now() < deadline) await delay(5);
  return serverHandles();
}

describe('Local HTTPS site of the hosted live gate (test support) with the real hosted composition and HTTP server', () => {
  test('Given a portal build directory that does not exist, when the site starts, then it rejects with the message that names the directory and npm run build:user-portal, keeps the file system error as the cause, and leaves no server listening', caseOptions, async (t) => {
    closeLeakedServersAfter(t);
    const missing = join(await temporaryDirectory(t), 'dist');
    const before = serverHandles();

    await assert.rejects(LocalHttpsSite.start(settings, { portalBuild: missing }), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, `The local HTTPS site has no portal build in ${missing}. Run npm run build:user-portal first; npm run test:hosted-live does it.`);
      assert.ok(error.cause instanceof Error);
      assert.equal((error.cause as NodeJS.ErrnoException).code, 'ENOENT');
      return true;
    });

    assert.equal(await serverHandlesAfterClose(before), before);
  });

  test('Given a portal build and a PATH without OpenSSL, when the site starts, then it rejects with the spawn error, closes the application that it started, and leaves no server listening', caseOptions, async (t) => {
    closeLeakedServersAfter(t);
    const portal = await writePortalBuild(t);
    const emptyDirectory = await temporaryDirectory(t);
    // The close of the hosted application closes its MCP server one time.
    const mcpServerClose = t.mock.method(MCPServer.prototype, 'close');
    const before = serverHandles();

    const started = withPath(t, emptyDirectory, () => LocalHttpsSite.start(settings, { portalBuild: portal }));

    await assert.rejects(started, { code: 'ENOENT', syscall: 'spawn openssl' });
    assert.deepEqual(
      { applicationCloses: mcpServerClose.mock.callCount(), serverHandles: await serverHandlesAfterClose(before) },
      { applicationCloses: 1, serverHandles: before },
    );
  });
});
