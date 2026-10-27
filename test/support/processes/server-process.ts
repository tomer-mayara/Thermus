import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import type { TestContext } from 'node:test';
import { listeningUrlIn, tenantIn } from '../drivers/operator-log.ts';
import { loopbackNetworkBlocker, networkBlocker, programEntry } from './module-paths.ts';

const outboundAttempt = /Outbound network access attempted/;

export type ServerSettings = Readonly<Record<string, string>>;

// How a server process runs: its program arguments, and its network. none: each outbound connection fails. loopback:
// only connections to 127.0.0.1 and ::1 go, for processes of one test that talk to each other.
export interface ServerRun {
  readonly args?: readonly string[];
  readonly network?: 'none' | 'loopback';
}

export interface ServerExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

export class ServerProcess {
  private readonly child: ChildProcessByStdio<null, Readable, Readable>;
  private readonly exit: Promise<ServerExit>;
  private readonly listening = Promise.withResolvers<URL>();
  private text = '';

  private constructor(settings: ServerSettings, run: ServerRun) {
    // The server runs with outbound access denied: each attempt fails and writes a line that a test can find.
    const blocker = run.network === 'loopback' ? loopbackNetworkBlocker : networkBlocker;
    this.child = spawn(process.execPath, [...(programEntry.endsWith('.ts') ? ['--import', 'tsx'] : []), '--import', blocker, programEntry, ...(run.args ?? [])], { env: { ...settings }, stdio: ['ignore', 'pipe', 'pipe'] });
    this.exit = once(this.child, 'exit').then(([code, signal]) => ({ code, signal }));
    for (const stream of [this.child.stdout, this.child.stderr]) {
      stream.setEncoding('utf8').on('data', (chunk: string) => this.record(chunk));
    }
  }

  static launch(t: TestContext, settings: ServerSettings, run: ServerRun = {}): ServerProcess {
    const server = new ServerProcess(settings, run);
    t.after(() => server.kill());
    return server;
  }

  static async start(t: TestContext, settings: ServerSettings, run: ServerRun = {}): Promise<ServerProcess> {
    const server = ServerProcess.launch(t, settings, run);
    await server.started();
    return server;
  }

  get output(): string {
    return this.text;
  }

  get attemptedOutboundAccess(): boolean {
    return outboundAttempt.test(this.text);
  }

  async started(): Promise<URL> {
    const url = await this.listeningOrExit();
    assert.ok(url, `The server stopped before it listened:\n${this.text}`);
    return url;
  }

  async listeningOrExit(): Promise<URL | undefined> {
    return Promise.race([this.listening.promise, this.exit.then(() => undefined)]);
  }

  tenant(): string {
    const tenant = tenantIn(this.text);
    assert.ok(tenant, `The server reported no local tenant:\n${this.text}`);
    return tenant;
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(new URL(path, await this.started()), init);
  }

  async stop(): Promise<ServerExit> {
    this.child.kill('SIGTERM');
    return this.exit;
  }

  // The signal goes out in the data callback that gets the listening line, so no other callback runs between the two.
  async stopWhenListening(signal: NodeJS.Signals): Promise<ServerExit> {
    const streams = [this.child.stdout, this.child.stderr];
    const stopIfListening = (): void => {
      if (listeningUrlIn(this.text) === undefined) return;
      for (const stream of streams) stream.off('data', stopIfListening);
      this.child.kill(signal);
    };
    for (const stream of streams) stream.on('data', stopIfListening);
    stopIfListening();
    return this.exit;
  }

  async exited(): Promise<ServerExit> {
    return this.exit;
  }

  private record(chunk: string): void {
    this.text += chunk;
    const url = listeningUrlIn(this.text);
    if (url !== undefined) this.listening.resolve(url);
  }

  private kill(): void {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }
}
