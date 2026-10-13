import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { test } from 'node:test';
import { serve } from '../../src/index.ts';
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
