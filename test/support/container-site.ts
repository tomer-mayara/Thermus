import assert from 'node:assert/strict';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import type { Readable } from 'node:stream';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { publicBaseUrl } from './better-auth-local.ts';
import type { CommandResult } from './command-process.ts';
import { docker, dockerOutput, type DockerResult } from './docker-cli.ts';
import type { ServerAddress } from './local-browser.ts';
import type { Operator } from './local-commands.ts';
import type { ServerExit } from './server-process.ts';

// The image keeps its data in this directory, and compose.yaml mounts the data volume here.
export const containerDataDirectory = '/var/lib/magumagu';
export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

const edgeScript = fileURLToPath(new URL('./container-edge.js', import.meta.url));
const probeScript = fileURLToPath(new URL('./container-probe.js', import.meta.url));
const run = randomBytes(4).toString('hex');
const runLabel = `magumagu.container-gate=${run}`;
const listeningLine = /Listening on http:\/\/\S+/;
const tenantLine = /tenant (local:[0-9a-f-]+)/;
const outboundQuery = /^Outbound DNS query.*$/gm;
const engineChecks = [['version', '--format', '{{.Server.Version}}'], ['buildx', 'version'], ['compose', 'version']];
let sites = 0;

export interface GateImages {
  readonly current: string;
  // The same build with another revision label: another image with the same content, as an update gives.
  readonly rebuilt: string;
}

export interface ServerContainerOptions {
  readonly image?: string;
  // Settings in addition to the image settings and PUBLIC_BASE_URL, or in place of them.
  readonly environment?: Readonly<Record<string, string>>;
}

// The gate fails with a setup error when the docker CLI, a running engine, Buildx, or Compose is missing.
export async function requireContainerEngine(): Promise<void> {
  for (const args of engineChecks) {
    const result = await docker(args).catch((error: unknown): DockerResult => ({ code: null, stdout: Buffer.alloc(0), stderr: String(error) }));
    if (result.code !== 0) {
      throw new Error(`The container gate needs the docker CLI, a running Docker engine, Buildx, and Compose. "docker ${args[0]}" failed:\n${result.stderr}`);
    }
  }
}

// Builds the image of the current candidate from the repository, as an operator builds it.
export async function buildGateImages(): Promise<GateImages> {
  await requireContainerEngine();
  return { current: await buildImage('current'), rebuilt: await buildImage('rebuilt') };
}

async function buildImage(revision: string): Promise<string> {
  const tag = `magumagu-container-gate:${run}-${revision}`;
  const labels = ['--label', runLabel, '--label', `org.opencontainers.image.revision=${revision}`];
  const result = await docker(['build', '--quiet', ...labels, '--tag', tag, repositoryRoot]);
  assert.equal(result.code, 0, `The image build failed:\n${result.stderr}`);
  return tag;
}

// Removes each container, network, volume, and image that this test run made.
export async function removeGateResources(): Promise<void> {
  await removeLabelled(runLabel);
  const images = await labelled(['image', 'ls'], runLabel);
  if (images.length > 0) await dockerOutput(['image', 'rm', '--force', ...images]);
}

async function removeLabelled(label: string): Promise<void> {
  const containers = await labelled(['container', 'ls', '--all'], label);
  if (containers.length > 0) await dockerOutput(['container', 'rm', '--force', ...containers]);
  for (const kind of ['network', 'volume']) {
    const names = await labelled([kind, 'ls'], label);
    if (names.length > 0) await dockerOutput([kind, 'rm', ...names]);
  }
}

async function labelled(list: readonly string[], label: string): Promise<string[]> {
  return (await dockerOutput([...list, '--quiet', '--filter', `label=${label}`])).split('\n').filter((id) => id !== '');
}

// Runs container-probe.js in a one-off container of the image without a network, with the volume when given.
export async function probeImage<T>(image: string, probe: string, volume?: string): Promise<T> {
  const mount = volume === undefined ? [] : ['--volume', `${volume}:${containerDataDirectory}`];
  const args = ['container', 'run', '--rm', '--interactive', '--label', runLabel, '--network', 'none', ...mount, '--env', `PROBE=${probe}`];
  const output = await dockerOutput([...args, '--entrypoint', 'node', image, '--input-type=module', '-'], { input: readFileSync(probeScript) });
  return JSON.parse(output) as T;
}

// The offline place of one test. The server and command containers use an internal network without a route
// out. The edge container connects the test to the server, and it is their DNS server, so it logs each
// outbound connection that they try by name. The site also makes the data volumes of the test.
export class ContainerSite {
  readonly image: string;
  readonly address: ServerAddress;
  private readonly id: string;
  private readonly network: string;
  private readonly edge: string;
  private readonly dns: string;
  private volumes = 0;
  private servers = 0;

  private constructor(image: string, names: { id: string; network: string; edge: string }, edgeAddress: { url: URL; dns: string }) {
    this.image = image;
    this.id = names.id;
    this.network = names.network;
    this.edge = names.edge;
    this.address = () => edgeAddress.url;
    this.dns = edgeAddress.dns;
  }

  static async open(t: TestContext, image: string): Promise<ContainerSite> {
    sites += 1;
    const id = `${run}-${sites}`;
    const siteLabel = `magumagu.container-gate.site=${id}`;
    t.after(() => removeLabelled(siteLabel));
    const labels = ['--label', runLabel, '--label', siteLabel];
    const names = { id, network: `magumagu-gate-${id}-offline`, edge: `magumagu-gate-${id}-edge` };
    const outside = `magumagu-gate-${id}-outside`;
    await dockerOutput(['network', 'create', '--internal', ...labels, names.network]);
    await dockerOutput(['network', 'create', ...labels, outside]);
    const edgeCommand = ['--user', 'root', '--entrypoint', 'node', image, '/tmp/container-edge.mjs'];
    await dockerOutput(['container', 'create', '--name', names.edge, ...labels, '--network', outside, '--publish', '127.0.0.1::8080', ...edgeCommand]);
    await dockerOutput(['network', 'connect', names.network, names.edge]);
    await dockerOutput(['container', 'cp', edgeScript, `${names.edge}:/tmp/container-edge.mjs`]);
    await dockerOutput(['container', 'start', names.edge]);
    await waitForLog(names.edge, /Edge ready/);
    const [published = ''] = (await dockerOutput(['container', 'port', names.edge, '8080/tcp'])).split('\n');
    const dns = await dockerOutput(['container', 'inspect', '--format', `{{(index .NetworkSettings.Networks "${names.network}").IPAddress}}`, names.edge]);
    return new ContainerSite(image, names, { url: new URL(`http://${published}/`), dns });
  }

  async volume(): Promise<string> {
    this.volumes += 1;
    return dockerOutput(['volume', 'create', ...this.labels(), `magumagu-gate-${this.id}-data-${this.volumes}`]);
  }

  // Runs each command in a one-off container of the image with the data volume, as the operator does while the server is stopped.
  operator(volume: string): Operator {
    return async (args, input = []) => {
      const container = ['container', 'run', '--rm', '--interactive', ...this.labels(), ...this.offlineNetwork(), ...dataVolume(volume), ...settings()];
      return commandResult(await docker([...container, this.image, ...args], { input: lines(input) }));
    };
  }

  async createServer(volume: string, options: ServerContainerOptions = {}): Promise<ServerContainer> {
    this.servers += 1;
    const name = `magumagu-gate-${this.id}-server-${this.servers}`;
    const container = ['container', 'create', '--init', '--name', name, ...this.labels(), ...this.offlineNetwork(), '--network-alias', 'magumagu'];
    await dockerOutput([...container, ...dataVolume(volume), ...settings(options.environment), options.image ?? this.image]);
    return new ServerContainer(name);
  }

  async startServer(volume: string, options: ServerContainerOptions = {}): Promise<ServerContainer> {
    const server = await this.createServer(volume, options);
    await server.start();
    return server;
  }

  // Copies the complete data volume of a stopped server to a tar archive, as the documented backup does.
  async backup(volume: string): Promise<Buffer> {
    const result = await docker(['container', 'run', '--rm', ...this.labels(), '--network', 'none', '--volume', `${volume}:${containerDataDirectory}:ro`,
      '--entrypoint', 'tar', this.image, '-cf', '-', '-C', containerDataDirectory, '.']);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout;
  }

  // Restores a backup archive into a new volume. The names in "without" stay out, as in an incomplete restore.
  async restore(archive: Buffer, without: readonly string[] = []): Promise<string> {
    const volume = await this.volume();
    const excluded = without.map((name) => `--exclude=./${name}`);
    const result = await docker(['container', 'run', '--rm', '--interactive', ...this.labels(), '--network', 'none', '--volume', `${volume}:${containerDataDirectory}`,
      '--entrypoint', 'tar', this.image, '-xf', '-', '-C', containerDataDirectory, ...excluded], { input: archive });
    assert.equal(result.code, 0, result.stderr);
    return volume;
  }

  async outboundQueries(): Promise<string[]> {
    const logs = await docker(['container', 'logs', this.edge]);
    return logs.stdout.toString('utf8').match(outboundQuery) ?? [];
  }

  async assertNoOutboundRequests(): Promise<void> {
    assert.deepEqual(await this.outboundQueries(), [], 'A container tried to connect to a host outside the offline network');
  }

  private labels(): string[] {
    return ['--label', runLabel, '--label', `magumagu.container-gate.site=${this.id}`];
  }

  private offlineNetwork(): string[] {
    return ['--network', this.network, '--dns', this.dns];
  }
}

// A server container of a site. Each start follows the output of the container until it stops.
export class ServerContainer {
  readonly name: string;
  private run?: AttachedRun;

  constructor(name: string) {
    this.name = name;
  }

  // The output of the current or the last run.
  get output(): string {
    return this.current().output;
  }

  // Starts the container and waits until it listens.
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

  async stop(): Promise<ServerExit> {
    await dockerOutput(['container', 'stop', this.name]);
    return this.current().exit;
  }

  async remove(): Promise<void> {
    await dockerOutput(['container', 'rm', this.name]);
  }

  // Runs a command of the bundled program in the running server container, as docker exec does.
  async exec(args: readonly string[], input: readonly string[] = []): Promise<CommandResult> {
    return commandResult(await docker(['container', 'exec', '--interactive', this.name, 'node', '/app/dist/src/index.js', ...args], { input: lines(input) }));
  }

  async inspect(field: 'Id' | 'Image'): Promise<string> {
    return dockerOutput(['container', 'inspect', '--format', `{{.${field}}}`, this.name]);
  }

  private current(): AttachedRun {
    assert.ok(this.run, `The server container ${this.name} has not started`);
    return this.run;
  }
}

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

function dataVolume(volume: string): string[] {
  return ['--volume', `${volume}:${containerDataDirectory}`];
}

// The image supplies the other settings. Only PUBLIC_BASE_URL has no image default.
function settings(environment: Readonly<Record<string, string>> = {}): string[] {
  return Object.entries({ PUBLIC_BASE_URL: publicBaseUrl, ...environment }).flatMap(([name, value]) => ['--env', `${name}=${value}`]);
}

function lines(input: readonly string[]): string {
  return input.map((line) => `${line}\n`).join('');
}

function commandResult({ code, stdout, stderr }: DockerResult): CommandResult {
  return { code, signal: null, stdout: stdout.toString('utf8'), stderr };
}

async function waitForLog(container: string, pattern: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const logs = await docker(['container', 'logs', container]);
    if (pattern.test(`${logs.stdout.toString('utf8')}${logs.stderr}`)) return;
    await delay(100);
  }
  assert.fail(`The container ${container} did not log ${pattern}`);
}
