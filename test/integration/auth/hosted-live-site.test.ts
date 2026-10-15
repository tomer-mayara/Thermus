import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { Server } from 'node:net';
import { join } from 'node:path';
import { describe, test, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { connect as tlsConnect } from 'node:tls';
import type { Application, ApplicationLogger } from '../../../src/application.ts';
import { MCPServer } from '../../../src/mcp/mcp-server.ts';
import { LocalHttpsSite, selfSignedCertificate } from '../../support/hosted-live/local-https-site.ts';
import { localOrigin, type HostedLiveSettings } from '../../support/hosted-live/settings.ts';
import { workOSSettings } from '../../support/hosted-placeholder.ts';

// The placeholder settings reach no WorkOS environment. The hosted composition makes no WorkOS call when it starts.
const settings: HostedLiveSettings = {
  apiKey: workOSSettings.WORKOS_API_KEY,
  clientId: workOSSettings.WORKOS_CLIENT_ID,
  authkitIssuer: workOSSettings.WORKOS_AUTHKIT_ISSUER,
};
const caseOptions = { timeout: 10_000 };
const front = new URL(localOrigin);
const portalPage = '<!doctype html><title>Portal</title>';
const knownPath = '/known';
const knownBody = 'The answer of the small application';

interface FrontAnswer {
  readonly status: number;
  readonly body: string;
}

class SmallApplication {
  readonly loggers: ApplicationLogger[] = [];
  closes = 0;

  readonly open = async (logger: ApplicationLogger): Promise<Application> => {
    this.loggers.push(logger);
    return {
      handle: async (request) => {
        if (new URL(request.url).pathname !== knownPath) throw new Error('The small application fails');
        return new Response(knownBody);
      },
      close: async () => { this.closes += 1; },
    };
  };
}

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'thermus-hosted-live-site-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writePortalBuild(t: TestContext): Promise<string> {
  const directory = await temporaryDirectory(t);
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), portalPage);
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

function serverHandles(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'TCPServerWrap').length;
}

// Node removes the handle of a closed server one event loop turn after the close.
async function serverHandlesAfterClose(before: number): Promise<number> {
  const deadline = Date.now() + 2_000;
  while (serverHandles() > before && Date.now() < deadline) await delay(5);
  return serverHandles();
}

// The connection accepts each certificate, so that the test can read the certificate of the front.
async function frontFingerprint(): Promise<string> {
  const socket = tlsConnect({ host: front.hostname, port: Number(front.port), servername: front.hostname, rejectUnauthorized: false });
  try {
    await once(socket, 'secureConnect');
    return socket.getPeerCertificate().fingerprint256;
  } finally {
    socket.destroy();
  }
}

// The request trusts only the given certificate. Without an agent, each request has its own connection, which closes
// after the answer.
function frontGet(path: string, ca: Buffer): Promise<FrontAnswer> {
  const answer = Promise.withResolvers<FrontAnswer>();
  const request = httpsRequest({ host: front.hostname, port: front.port, path, ca, agent: false }, (response) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk)).on('error', answer.reject)
      .on('end', () => answer.resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
  });
  request.on('error', answer.reject).end();
  return answer.promise;
}

describe('Local HTTPS site of the hosted live gate (test support) with the real HTTP server', () => {
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

  // This case listens on port 46443, the port of the hosted live gate and the work slice. It fails while one of them runs.
  test('Given a portal build, certificate files from the OpenSSL command of the site, a logger, and an application function, when the site starts, then the front at https://localhost:46443/ gives that certificate, serves the portal, and forwards each other request to the application of that function, which gets that logger; a request that the application fails gives 500 and a report to that logger; close() closes the application one time and leaves no server listening', caseOptions, async (t) => {
    closeLeakedServersAfter(t);
    const portal = await writePortalBuild(t);
    const certificate = await selfSignedCertificate(await temporaryDirectory(t));
    const logger = { info: t.mock.fn<(message: string) => void>(), error: t.mock.fn<(message: string) => void>() };
    const application = new SmallApplication();
    const before = serverHandles();

    const site = await LocalHttpsSite.start(settings, { portalBuild: portal, certificate, logger, application: application.open });
    t.after(() => site.close());
    const fingerprint = await frontFingerprint();
    const answers = [await frontGet('/', certificate.cert), await frontGet(knownPath, certificate.cert), await frontGet('/fails', certificate.cert)];
    await site.close();

    assert.equal(fingerprint, new X509Certificate(certificate.cert).fingerprint256);
    assert.deepEqual(answers, [
      { status: 200, body: portalPage },
      { status: 200, body: knownBody },
      { status: 500, body: 'Internal Server Error' },
    ]);
    assert.equal(application.loggers.length, 1);
    assert.equal(application.loggers[0], logger);
    assert.deepEqual(logger.error.mock.calls.map(({ arguments: [message] }) => message), ['The HTTP handler failed for GET /fails: Error']);
    assert.deepEqual(site.log.lines, []);
    assert.deepEqual(
      { applicationCloses: application.closes, serverHandles: await serverHandlesAfterClose(before) },
      { applicationCloses: 1, serverHandles: before },
    );
  });
});
