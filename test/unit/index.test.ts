import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { test } from 'node:test';
import { serve } from '../../src/index.ts';

const stopSignals = ['SIGINT', 'SIGTERM'] as const;
const hostedEnvironment = { DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://magumagu.example', LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0' };
const hostedNotice = 'Hosted authentication is not available yet. Each hosted request gets the authentication-unavailable notice.';

interface LogLine {
  readonly message: string;
  // The stop signals that have a handler when the line is written.
  readonly handled: readonly NodeJS.Signals[];
}

// The emitter is the double for the process signal registration: emit() sends a signal as the process does.
class ServeRecord {
  readonly signals = new EventEmitter();
  readonly lines: LogLine[] = [];
  readonly listening = Promise.withResolvers<void>();
  readonly logger = {
    info: (message: string): void => {
      this.lines.push({ message, handled: this.handled() });
      if (message.startsWith('Listening on ')) this.listening.resolve();
    },
    error: (message: string): void => {
      this.lines.push({ message: `ERROR ${message}`, handled: this.handled() });
    },
  };

  handled(): NodeJS.Signals[] {
    return stopSignals.filter((signal) => this.signals.listenerCount(signal) > 0);
  }
}

function withoutPort({ message, handled }: LogLine): LogLine {
  return { message: message.replace(/:\d+$/, ':<port>'), handled };
}

for (const signal of stopSignals) {
  test(`Given the serve sequence with a double for the process signal registration, when the server starts and gets ${signal}, then the stop handlers are registered before the "Listening on" line is written and removed after the stop`, { timeout: 5_000 }, async () => {
    const record = new ServeRecord();

    const served = serve(hostedEnvironment, record.logger, record.signals);
    await record.listening.promise;
    record.signals.emit(signal, signal);
    await served;

    assert.deepEqual(record.lines.map(withoutPort), [
      { message: hostedNotice, handled: [] },
      { message: 'Listening on http://127.0.0.1:<port>', handled: ['SIGINT', 'SIGTERM'] },
      { message: `Stopping after ${signal}`, handled: [] },
    ]);
    assert.deepEqual(record.handled(), []);
  });
}

test('Given a listen port that another server uses, when the serve sequence starts, then it rejects before the "Listening on" line, and no stop handler stays registered', { timeout: 5_000 }, async (t) => {
  const blocker = createServer().listen(0, '127.0.0.1');
  t.after(() => blocker.close());
  await once(blocker, 'listening');
  const { port } = blocker.address() as AddressInfo;
  const record = new ServeRecord();

  await assert.rejects(serve({ ...hostedEnvironment, LISTEN_PORT: String(port) }, record.logger, record.signals), { code: 'EADDRINUSE' });

  assert.deepEqual(record.lines, [{ message: hostedNotice, handled: [] }]);
  assert.deepEqual(record.handled(), []);
});
