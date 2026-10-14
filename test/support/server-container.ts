import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';
import type { CommandResult } from './command-process.ts';
import { dockerCommand, dockerOutput } from './docker-cli.ts';
import type { ServerExit } from './server-process.ts';

const listeningLine = /Listening on http:\/\/\S+/;
const tenantLine = /tenant (local:[0-9a-f-]+)/;
const completionLine = /\{"event":"mcp\.tool\.completed".*\}$/gm;

export class ServerContainer {
  readonly name: string;
  private run?: AttachedRun;

  constructor(name: string) {
    this.name = name;
  }

  get output(): string {
    return this.current().output;
  }

  async start(): Promise<void> {
    this.launch();
    assert.equal(await this.listeningOrExit(), true, `The server container stopped before it listened:\n${this.output}`);
  }

  launch(): void {
    this.run = new AttachedRun(this.name);
  }

  listeningOrExit(): Promise<boolean> {
    return this.current().listeningOrExit();
  }

  exited(): Promise<ServerExit> {
    return this.current().exit;
  }

  tenant(): string {
    const tenant = tenantLine.exec(this.output)?.[1];
    assert.ok(tenant, `The server reported no local tenant:\n${this.output}`);
    return tenant;
  }

  completionLines(): string[] {
    return this.output.match(completionLine) ?? [];
  }

  completionRecords(): Record<string, unknown>[] {
    return this.completionLines().map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  async stop(): Promise<ServerExit> {
    await dockerOutput(['container', 'stop', this.name]);
    return this.current().exit;
  }

  async remove(): Promise<void> {
    await dockerOutput(['container', 'rm', this.name]);
  }

  async exec(args: readonly string[], input: readonly string[] = []): Promise<CommandResult> {
    return this.runProgram(['node', '/app/dist/src/index.js', ...args], input);
  }

  async runProgram(command: readonly string[], input: readonly string[] = []): Promise<CommandResult> {
    return dockerCommand(['container', 'exec', '--interactive', this.name, ...command], input);
  }

  async inspect(field: 'Id' | 'Image'): Promise<string> {
    return dockerOutput(['container', 'inspect', '--format', `{{.${field}}}`, this.name]);
  }

  private current(): AttachedRun {
    assert.ok(this.run, `The server container ${this.name} has not started`);
    return this.run;
  }
}

// One start of the container. docker start --attach gives the output of this run and ends with the container.
class AttachedRun {
  readonly exit: Promise<ServerExit>;
  private readonly child: ChildProcessByStdio<null, Readable, Readable>;
  private readonly listening = Promise.withResolvers<true>();
  private text = '';

  constructor(name: string) {
    this.child = spawn('docker', ['container', 'start', '--attach', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.exit = once(this.child, 'close').then(([code, signal]) => ({ code, signal }));
    for (const stream of [this.child.stdout, this.child.stderr]) {
      stream.setEncoding('utf8').on('data', (chunk: string) => this.record(chunk));
    }
  }

  get output(): string {
    return this.text;
  }

  listeningOrExit(): Promise<boolean> {
    return Promise.race([this.listening.promise, this.exit.then(() => false)]);
  }

  private record(chunk: string): void {
    this.text += chunk;
    if (listeningLine.test(this.text)) this.listening.resolve(true);
  }
}
