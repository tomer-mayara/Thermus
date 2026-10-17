import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { TestContext } from 'node:test';
import { serve } from '../../../src/index.ts';
import { completionLinesIn, completionRecordsIn, listeningUrlIn, tenantIn } from '../drivers/operator-log.ts';

type Settings = Readonly<Record<string, string | undefined>>;

interface Run {
  readonly url: URL;
  readonly signals: EventEmitter;
  readonly served: Promise<void>;
}

// Runs the production serve sequence in the test process, so the test doubles of Node APIs reach the server.
// A stop sends SIGTERM through a signal double. The server can start again, also on another port.
export class InProcessServer {
  readonly lines: string[] = [];
  private run?: Run;

  readonly address = (): URL => {
    assert.ok(this.run, 'the server is not running');
    return this.run.url;
  };

  static open(t: TestContext): InProcessServer {
    const server = new InProcessServer();
    t.after(() => server.run === undefined ? undefined : server.stop());
    return server;
  }

  async start(settings: Settings): Promise<void> {
    assert.equal(this.run, undefined, 'the server is already running');
    const signals = new EventEmitter();
    const listening = Promise.withResolvers<URL>();
    const logger = {
      info: (message: string): void => {
        this.lines.push(message);
        const url = listeningUrlIn(message);
        if (url !== undefined) listening.resolve(url);
      },
      error: (message: string): void => { this.lines.push(`ERROR ${message}`); },
    };
    const served = serve(settings, logger, signals);
    const url = await Promise.race([listening.promise, served.then(() => assert.fail('the server stopped before it listened'))]);
    this.run = { url, signals, served };
  }

  async stop(): Promise<void> {
    const run = this.run;
    assert.ok(run, 'the server is not running');
    this.run = undefined;
    run.signals.emit('SIGTERM', 'SIGTERM');
    await run.served;
  }

  tenant(): string {
    const tenant = tenantIn(this.output);
    assert.ok(tenant, `the server reported no local tenant:\n${this.output}`);
    return tenant;
  }

  completionRecords(): Record<string, unknown>[] {
    return completionRecordsIn(this.output);
  }

  completionLines(): string[] {
    return completionLinesIn(this.output);
  }

  errorLines(): string[] {
    return this.lines.filter((line) => line.startsWith('ERROR ')).map((line) => line.slice('ERROR '.length));
  }

  private get output(): string {
    return this.lines.join('\n');
  }
}
