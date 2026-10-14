import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { connect, createServer, type AddressInfo } from 'node:net';
import { test } from 'node:test';
import { DataDirectoryInUseError, lockDataDirectory } from '../../src/auth/local-auth/better-auth/data-directory-lock.ts';
import { serve } from '../../src/index.ts';
import { MCPServer } from '../../src/mcp/mcp-server.ts';
import { dataDirectory } from '../support/data-directory.ts';
import { hostedStartupLine } from '../support/hosted-placeholder.ts';

const stopSignals = ['SIGINT', 'SIGTERM'] as const;
const hostedEnvironment = { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };

interface LogLine {
  readonly message: string;
  readonly signalsWithHandler: readonly NodeJS.Signals[];
}

class ServeRecord {
  readonly processSignals = new EventEmitter();
  readonly lines: LogLine[] = [];
  readonly listening = Promise.withResolvers<void>();
  readonly logger = {
    info: (message: string): void => {
      this.lines.push({ message, signalsWithHandler: this.signalsWithHandler() });
      if (message.startsWith('Listening on ')) this.listening.resolve();
    },
    error: (message: string): void => {
      this.lines.push({ message: `ERROR ${message}`, signalsWithHandler: this.signalsWithHandler() });
    },
  };

  sendSignal(signal: NodeJS.Signals): void {
    this.processSignals.emit(signal, signal);
  }

  signalsWithHandler(): NodeJS.Signals[] {
    return stopSignals.filter((signal) => this.processSignals.listenerCount(signal) > 0);
  }
}

function withoutPort({ message, signalsWithHandler }: LogLine): LogLine {
  return { message: message.replace(/:\d+$/, ':<port>'), signalsWithHandler };
}

for (const signal of stopSignals) {
  test(`Given the serve sequence with a double for the process signal registration, when the server starts and gets ${signal}, then the stop handlers are registered before the "Listening on" line is written and removed after the stop`, { timeout: 5_000 }, async () => {
    const record = new ServeRecord();

    const served = serve(hostedEnvironment, record.logger, record.processSignals);
    await Promise.race([record.listening.promise, served]);
    record.sendSignal(signal);
    await served;

    assert.deepEqual(record.lines.map(withoutPort), [
      { message: hostedStartupLine, signalsWithHandler: [] },
      { message: 'Listening on http://127.0.0.1:<port>', signalsWithHandler: ['SIGINT', 'SIGTERM'] },
      { message: `Stopping after ${signal}`, signalsWithHandler: [] },
    ]);
    assert.deepEqual(record.signalsWithHandler(), []);
  });
}

test('Given a listen port that another server uses, when the serve sequence starts, then it rejects before the "Listening on" line, and no stop handler stays registered', { timeout: 5_000 }, async (t) => {
  const blocker = createServer().listen(0, '127.0.0.1');
  t.after(() => blocker.close());
  await once(blocker, 'listening');
  const { port } = blocker.address() as AddressInfo;
  const record = new ServeRecord();

  await assert.rejects(serve({ ...hostedEnvironment, LISTEN_PORT: String(port) }, record.logger, record.processSignals), { code: 'EADDRINUSE' });

  assert.deepEqual(record.lines, [{ message: hostedStartupLine, signalsWithHandler: [] }]);
  assert.deepEqual(record.signalsWithHandler(), []);
});

test('Given active application work and a real listener, when a stop signal arrives, then work closes before listener drain and the provider stays open until both finish', { timeout: 10_000 }, async (t) => {
  const directory = dataDirectory(t);
  const record = new ServeRecord();
  const requested = Promise.withResolvers<void>();
  const responseReady = Promise.withResolvers<void>();
  const workDone = Promise.withResolvers<void>();
  const workClosed = Promise.withResolvers<void>();
  let workCloses = 0;
  t.mock.method(MCPServer.prototype, 'fetch', async () => {
    requested.resolve();
    await responseReady.promise;
    return new Response('finished');
  });
  t.mock.method(MCPServer.prototype, 'close', async () => {
    workCloses++;
    await workDone.promise;
    workClosed.resolve();
  });
  const served = serve({ ...hostedEnvironment, DEPLOYMENT: 'self-hosted', DATA_DIR: directory, PUBLIC_BASE_URL: 'http://localhost:8080' }, record.logger, record.processSignals);
  await Promise.race([record.listening.promise, served]);
  const listeningLine = record.lines.find(({ message }) => message.startsWith('Listening on '));
  assert.ok(listeningLine);
  const address = new URL(listeningLine.message.slice('Listening on '.length));
  const response = fetch(new URL('/mcp', address));
  await requested.promise;

  try {
    record.sendSignal('SIGTERM');
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(workCloses, 1, 'MCP cleanup must start while the HTTP response is still pending.');
    const refused = connect(Number(address.port), address.hostname);
    const [error] = await once(refused, 'error');
    assert.equal((error as NodeJS.ErrnoException).code, 'ECONNREFUSED');
    assert.throws(() => lockDataDirectory(directory), DataDirectoryInUseError);
    workDone.resolve();
    await workClosed.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.throws(() => lockDataDirectory(directory), DataDirectoryInUseError);
  } finally {
    workDone.resolve();
    responseReady.resolve();
    await (await response).text();
    await served;
  }

  assert.equal(workCloses, 1);
  lockDataDirectory(directory).release();
  assert.deepEqual(record.signalsWithHandler(), []);
});

for (const cleanupFails of [false, true]) {
  test(`Given an opened provider and listener, when the listening log fails during startup${cleanupFails ? ' and MCP cleanup fails' : ''}, then cleanup closes owned work once, removes signal listeners, and retains each failure`, { timeout: 10_000 }, async (t) => {
    const directory = dataDirectory(t);
    const record = new ServeRecord();
    const failure = new Error('The startup log failed');
    const cleanupFailure = new Error('MCP cleanup failed');
    const close = t.mock.method(MCPServer.prototype, 'close', async () => { if (cleanupFails) throw cleanupFailure; });
    let address: URL | undefined;
    const logger = {
      info: (message: string): void => {
        record.logger.info(message);
        if (message.startsWith('Listening on ')) {
          address = new URL(message.slice('Listening on '.length));
          throw failure;
        }
      },
      error: record.logger.error,
    };

    await assert.rejects(serve({ ...hostedEnvironment, DEPLOYMENT: 'self-hosted', DATA_DIR: directory, PUBLIC_BASE_URL: 'http://localhost:8080' }, logger, record.processSignals), (error) => {
      if (!cleanupFails) return error === failure;
      assert.ok(error instanceof SuppressedError);
      assert.equal(error.error, cleanupFailure);
      assert.equal(error.suppressed, failure);
      return true;
    });

    assert.equal(close.mock.callCount(), 1);
    assert.deepEqual(record.signalsWithHandler(), []);
    lockDataDirectory(directory).release();
    assert.ok(address);
    const refused = connect(Number(address.port), address.hostname);
    const [error] = await once(refused, 'error');
    assert.equal((error as NodeJS.ErrnoException).code, 'ECONNREFUSED');
  });
}
