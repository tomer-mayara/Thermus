import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverEntry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const listeningLine = /Listening on (http:\/\/\S+)/;
const tenantLine = /tenant (local:[0-9a-f-]+)/;

export type ServerSettings = Readonly<Record<string, string>>;

export interface ServerExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}

export class ServerProcess {
  private readonly child: ChildProcessByStdio<null, Readable, Readable>;
  private readonly exit: Promise<ServerExit>;
  private readonly listening = Promise.withResolvers<URL>();
  private text = '';

  private constructor(settings: ServerSettings, args: readonly string[]) {
    this.child = spawn(process.execPath, [serverEntry, ...args], { env: { ...settings }, stdio: ['ignore', 'pipe', 'pipe'] });
    this.exit = once(this.child, 'exit').then(([code, signal]) => ({ code, signal }));
    for (const stream of [this.child.stdout, this.child.stderr]) {
      stream.setEncoding('utf8').on('data', (chunk: string) => this.record(chunk));
    }
  }

  static launch(t: TestContext, settings: ServerSettings, args: readonly string[] = []): ServerProcess {
    const server = new ServerProcess(settings, args);
    t.after(() => server.kill());
    return server;
  }

  static async start(t: TestContext, settings: ServerSettings): Promise<ServerProcess> {
    const server = ServerProcess.launch(t, settings);
    await server.started();
    return server;
  }

  get output(): string {
    return this.text;
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
    const tenant = tenantLine.exec(this.text)?.[1];
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

  async exited(): Promise<ServerExit> {
    return this.exit;
  }

  private record(chunk: string): void {
    this.text += chunk;
    const address = listeningLine.exec(this.text)?.[1];
    if (address !== undefined) this.listening.resolve(new URL(address));
  }

  private kill(): void {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }
}
