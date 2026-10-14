import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { TestContext } from 'node:test';
import { serve } from '../../src/index.ts';

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
        const address = /^Listening on (\S+)$/.exec(message)?.[1];
        if (address !== undefined) listening.resolve(new URL(address));
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
    const tenant = this.lines.map((line) => /tenant (local:[0-9a-f-]+)\./.exec(line)?.[1]).find((match) => match !== undefined);
    assert.ok(tenant, `the server reported no local tenant:\n${this.lines.join('\n')}`);
    return tenant;
  }

  completionRecords(): Record<string, unknown>[] {
    return this.completionLines().map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  completionLines(): string[] {
    return this.lines.filter((line) => line.startsWith('{"event":"mcp.tool.completed"'));
  }

  errorLines(): string[] {
    return this.lines.filter((line) => line.startsWith('ERROR ')).map((line) => line.slice('ERROR '.length));
  }
}
