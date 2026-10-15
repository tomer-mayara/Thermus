import assert from 'node:assert/strict';
import { connect } from 'node:net';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { trustedAdRulesFile } from '../ad-rules.ts';
import { publicBaseUrl } from '../in-process/better-auth-local.ts';
import { containerAdRulesFile, containerDataDirectory, gateLabel, gateRun, removeLabelled } from './container-gate.ts';
import { docker, dockerCommand, dockerOutput } from './docker-cli.ts';
import type { ServerAddress } from '../drivers/browser/local-browser.ts';
import type { Operator } from '../dsl/local-commands.ts';
import { ServerContainer } from './server-container.ts';

export const edgeScript = fileURLToPath(new URL('./container-edge.js', import.meta.url));
export const pageScript = fileURLToPath(new URL('./container-page.js', import.meta.url));
const containerPageScript = '/tmp/container-page.mjs';
const outboundQuery = /^Outbound DNS query.*$/gm;
let sites = 0;

interface ServerContainerOptions {
  readonly image?: string;
  readonly environment?: Readonly<Record<string, string>>;
  // false starts the server without the trusted rules file.
  readonly adRules?: false;
  // Loads the test-only page seam of container-page.ts into the server, with renderer access to the page or without it.
  readonly page?: 'permitted' | 'blocked';
}

interface SiteNames {
  readonly id: string;
  readonly network: string;
  readonly edge: string;
}

// The offline place of one test. The server and command containers use an internal network without a route
// out, so each outbound connection fails. The edge container connects the test to the server, and it is their
// DNS server, so it logs each outbound connection that they try by name. A lookup of the control name shows
// that the log of this site works. All requests reach the server from the edge address, so one server run
// allows only three sign-ins in ten seconds. The site also makes the data volumes of the test.
export class ContainerSite {
  readonly image: string;
  readonly address: ServerAddress;
  private readonly names: SiteNames;
  private readonly dns: string;
  private readonly controlName: string;
  private volumes = 0;
  private servers = 0;

  private constructor(image: string, names: SiteNames, edge: { url: URL; dns: string }) {
    this.image = image;
    this.names = names;
    this.address = () => edge.url;
    this.dns = edge.dns;
    this.controlName = `outbound-control-${names.id}.example`;
  }

  static async open(t: TestContext, image: string): Promise<ContainerSite> {
    sites += 1;
    const id = `${gateRun}-${sites}`;
    const labels = siteLabels(id);
    t.after(() => removeLabelled(siteLabel(id)));
    const names = { id, network: `thermus-gate-${id}-offline`, edge: `thermus-gate-${id}-edge` };
    const outside = `thermus-gate-${id}-outside`;
    await dockerOutput(['network', 'create', '--internal', ...labels, names.network]);
    await dockerOutput(['network', 'create', ...labels, outside]);
    const edgeCommand = ['--user', 'root', '--entrypoint', 'node', image, '/tmp/container-edge.mjs'];
    await dockerOutput(['container', 'create', '--name', names.edge, ...labels, '--network', outside, '--publish', '127.0.0.1::8080', ...edgeCommand]);
    await dockerOutput(['network', 'connect', names.network, names.edge]);
    await dockerOutput(['container', 'cp', edgeScript, `${names.edge}:/tmp/container-edge.mjs`]);
    await dockerOutput(['container', 'start', names.edge]);
    await waitForLog(names.edge, /Edge ready/);
    const [published = ''] = (await dockerOutput(['container', 'port', names.edge, '8080/tcp'])).split('\n');
    const dns = await networkAddress(names.network, names.edge);
    const site = new ContainerSite(image, names, { url: new URL(`http://${published}/`), dns });
    await waitForConnection(site.address());
    await site.lookUpControlName();
    return site;
  }

  async volume(): Promise<string> {
    this.volumes += 1;
    return dockerOutput(['volume', 'create', ...siteLabels(this.names.id), `thermus-gate-${this.names.id}-data-${this.volumes}`]);
  }

  operator(volume: string): Operator {
    return (args, input) => dockerCommand(['container', 'run', '--rm', '--interactive', ...this.containerSettings(volume), this.image, ...args], input);
  }

  async createServer(volume: string, options: ServerContainerOptions = {}): Promise<ServerContainer> {
    this.servers += 1;
    const name = `thermus-gate-${this.names.id}-server-${this.servers}`;
    const server = ['container', 'create', '--init', '--name', name, '--network-alias', 'thermus'];
    const page: Record<string, string> = options.page === undefined ? {} : { NODE_OPTIONS: `--import=${containerPageScript}`, CONTAINER_GATE_PAGE: options.page };
    await dockerOutput([...server, ...this.containerSettings(volume, { ...options.environment, ...page }), options.image ?? this.image]);
    // The engine copies the files into the container, so the gate needs no host path that the engine shares.
    if (options.adRules !== false) await dockerOutput(['container', 'cp', trustedAdRulesFile, `${name}:${containerAdRulesFile}`]);
    if (options.page !== undefined) await dockerOutput(['container', 'cp', pageScript, `${name}:${containerPageScript}`]);
    return new ServerContainer(name);
  }

  async startServer(volume: string, options: ServerContainerOptions = {}): Promise<ServerContainer> {
    const server = await this.createServer(volume, options);
    await server.start();
    return server;
  }

  async backup(volume: string): Promise<Buffer> {
    const result = await docker(['container', 'run', '--rm', ...siteLabels(this.names.id), '--network', 'none', '--volume', `${volume}:${containerDataDirectory}:ro`,
      '--entrypoint', 'tar', this.image, '-cf', '-', '-C', containerDataDirectory, '.']);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout;
  }

  async restore(archive: Buffer, omittedFiles: readonly string[] = []): Promise<string> {
    const volume = await this.volume();
    const excluded = omittedFiles.map((name) => `--exclude=./${name}`);
    const result = await docker(['container', 'run', '--rm', '--interactive', ...siteLabels(this.names.id), '--network', 'none', '--volume', `${volume}:${containerDataDirectory}`,
      '--entrypoint', 'tar', this.image, '-xf', '-', '-C', containerDataDirectory, ...excluded], { input: archive });
    assert.equal(result.code, 0, result.stderr);
    return volume;
  }

  async privateAddress(container: string): Promise<string> {
    return networkAddress(this.names.network, container);
  }

  async outboundQueries(): Promise<string[]> {
    const logs = await docker(['container', 'logs', this.names.edge]);
    return (logs.stdout.toString('utf8').match(outboundQuery) ?? []).filter((line) => !line.includes(this.controlName));
  }

  async assertNoOutboundRequests(): Promise<void> {
    assert.deepEqual(await this.outboundQueries(), [], 'A container tried to connect to a host outside the offline network');
  }

  private async lookUpControlName(): Promise<void> {
    const lookup = `require('node:dns').lookup(${JSON.stringify(this.controlName)}, () => undefined)`;
    const network = ['--network', this.names.network, '--dns', this.dns];
    const result = await dockerCommand(['container', 'run', '--rm', ...siteLabels(this.names.id), ...network, '--entrypoint', 'node', this.image, '--eval', lookup]);
    assert.equal(result.code, 0, result.stderr);
    await waitForLog(this.names.edge, new RegExp(`Outbound DNS query for ${this.controlName.replaceAll('.', '\\.')}`));
  }

  // The image supplies the other settings. Only PUBLIC_BASE_URL has no image default.
  private containerSettings(volume: string, environment: Readonly<Record<string, string>> = {}): string[] {
    const settings = Object.entries({ PUBLIC_BASE_URL: publicBaseUrl, ...environment }).flatMap(([name, value]) => ['--env', `${name}=${value}`]);
    return [...siteLabels(this.names.id), '--network', this.names.network, '--dns', this.dns, '--volume', `${volume}:${containerDataDirectory}`, ...settings];
  }
}

function networkAddress(network: string, container: string): Promise<string> {
  return dockerOutput(['container', 'inspect', '--format', `{{(index .NetworkSettings.Networks "${network}").IPAddress}}`, container]);
}

function siteLabel(id: string): string {
  return `thermus.container-gate.site=${id}`;
}

function siteLabels(id: string): string[] {
  return ['--label', gateLabel, '--label', siteLabel(id)];
}

async function waitForConnection(address: URL): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await accepts(address)) return;
    await delay(100);
  }
  assert.fail(`The published address ${address.host} accepted no connection`);
}

function accepts(address: URL): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(Number(address.port), address.hostname);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function waitForLog(container: string, pattern: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const logs = await docker(['container', 'logs', container]);
    if (pattern.test(`${logs.stdout.toString('utf8')}${logs.stderr}`)) return;
    await delay(100);
  }
  assert.fail(`The container ${container} did not log ${pattern}`);
}
