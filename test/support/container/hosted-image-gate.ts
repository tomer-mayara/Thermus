import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { basename, join } from 'node:path';
import type { TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { listeningUrlIn } from '../drivers/operator-log.ts';
import { workOSSettingsFor } from '../fixtures/hosted-placeholder.ts';
import { containerPageScript, hostedImageIdentity, repositoryRoot } from '../processes/module-paths.ts';
import { docker, dockerOutput, type DockerResult } from './docker-cli.ts';

const root = fileURLToPath(repositoryRoot);
// The emitted test support in the image. The identity preload must be here, because its relative imports find the
// compiled src of the image at /app/dist/src. The page seam is mounted next to it.
const mountedSupport = '/app/dist/test/support/container/';
const identityTarget = `${mountedSupport}${basename(hostedImageIdentity)}`;
const pageTarget = `${mountedSupport}${basename(containerPageScript)}`;
const publicBaseUrl = 'https://thermus.example/';
const settings = { ...workOSSettingsFor(publicBaseUrl), PUBLIC_BASE_URL: publicBaseUrl };
const callerBuiltImage = process.env.THERMUS_HOSTED_GATE_IMAGE ?? '';

export class HostedImageGate {
  readonly tag: string;
  private readonly id = randomBytes(6).toString('hex');
  private readonly label: string;
  private containers = 0;

  constructor(private readonly t: TestContext) {
    this.tag = callerBuiltImage === '' ? `thermus-hosted-gate:${this.id}` : callerBuiltImage;
    this.label = `thermus.hosted-image-gate=${this.id}`;
    t.after(() => this.cleanup());
  }

  async build(): Promise<void> {
    if (callerBuiltImage !== '') return this.reuseCallerBuiltImage();
    const result = await this.buildContext(root, this.tag);
    assert.equal(result.code, 0, `Hosted AMD64 image build failed:\n${result.stderr}`);
  }

  private async reuseCallerBuiltImage(): Promise<void> {
    const [platform, id] = (await dockerOutput(['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}} {{.Id}}', this.tag], { signal: this.t.signal })).split(' ');
    assert.equal(platform, 'linux/amd64', `THERMUS_HOSTED_GATE_IMAGE names ${this.tag}, a ${platform} image`);
    this.t.diagnostic(`Reused the caller-built image ${this.tag} (${id}); the gate built no image and removes only its containers`);
  }

  async server(environment: Readonly<Record<string, string>> = {}, seam = true, signal = this.t.signal): Promise<HostedImageServer> {
    const mounts = seam ? [
      '--mount', `type=bind,src=${hostedImageIdentity},dst=${identityTarget},readonly`,
      '--mount', `type=bind,src=${containerPageScript},dst=${pageTarget},readonly`,
      '--env', `NODE_OPTIONS=--import=${identityTarget} --import=${pageTarget}`,
      '--env', 'CONTAINER_GATE_PAGE=hosted',
    ] : [];
    const name = await this.createAndStart(environment, ['--publish', '127.0.0.1::8080', ...mounts], signal);
    const binding = await dockerOutput(['container', 'port', name, '8080/tcp'], { signal });
    return new HostedImageServer(name, new URL(`http://${binding}/`), signal);
  }

  rejectedStartup(environment: Readonly<Record<string, string>>, signal: AbortSignal): Promise<{ code: number; logs: string }> {
    return this.startupFailure(environment, [], signal);
  }

  rejectedMissingPortal(signal: AbortSignal): Promise<{ code: number; logs: string }> {
    return this.startupFailure({}, ['--mount', 'type=volume,dst=/app/src/interfaces/user-portal/dist,volume-nocopy'], signal);
  }

  private async createAndStart(environment: Readonly<Record<string, string>>, options: readonly string[], signal: AbortSignal): Promise<string> {
    this.containers += 1;
    const name = `thermus-hosted-gate-${this.id}-${this.containers}`;
    const variables = Object.entries({ ...settings, ...environment }).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
    await dockerOutput(['container', 'create', '--platform', 'linux/amd64', '--label', this.label, '--name', name, ...variables, ...options, this.tag], { signal });
    await dockerOutput(['container', 'start', name], { signal });
    return name;
  }

  private async startupFailure(environment: Readonly<Record<string, string>>, options: readonly string[], signal: AbortSignal): Promise<{ code: number; logs: string }> {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
    const name = await this.createAndStart(environment, options, bounded);
    const code = Number(await dockerOutput(['container', 'wait', name], { signal: bounded }));
    const { stdout, stderr } = await docker(['container', 'logs', name], { signal: bounded });
    return { code, logs: stdout.toString('utf8') + stderr };
  }

  private buildContext(context: string, tag: string, signal = this.t.signal): Promise<DockerResult> {
    return docker(['build', '--platform', 'linux/amd64', '--progress=plain', '--file', join(context, 'Dockerfile.hosted'), '--label', this.label, '--tag', tag, context], { signal });
  }

  private async cleanup(): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    const containers = await dockerOutput(['container', 'ls', '--all', '--quiet', '--filter', `label=${this.label}`], { signal });
    if (containers !== '') await dockerOutput(['container', 'rm', '--force', '--volumes', ...containers.split('\n')], { signal });
    const images = await dockerOutput(['image', 'ls', '--quiet', '--filter', `label=${this.label}`], { signal });
    if (images !== '') await dockerOutput(['image', 'rm', '--force', ...new Set(images.split('\n'))], { signal });
  }
}

class HostedImageServer {
  constructor(readonly name: string, readonly url: URL, private readonly signal: AbortSignal) {}

  logs(signal = this.signal): Promise<string> {
    return docker(['container', 'logs', this.name], { signal }).then(({ stdout, stderr }) => stdout.toString('utf8') + stderr);
  }

  async waitForLog(text: string, count = 1): Promise<void> {
    await this.waitForLogs((logs) => logs.split(text).length - 1 >= count);
  }

  async started(): Promise<void> {
    await this.waitForLogs((logs) => listeningUrlIn(logs) !== undefined);
    assert.equal((await fetch(new URL('/healthz', this.url), { signal: this.signal })).status, 200);
  }

  private async waitForLogs(found: (logs: string) => boolean): Promise<void> {
    const signal = AbortSignal.any([this.signal, AbortSignal.timeout(30_000)]);
    while (!found(await this.logs(signal))) await delay(50, undefined, { signal });
  }

  async exited(): Promise<number> {
    const result = await dockerOutput(['container', 'wait', this.name], { signal: AbortSignal.any([this.signal, AbortSignal.timeout(15_000)]) });
    return Number(result);
  }

  async stop(): Promise<{ code: number; duration: number; logs: string }> {
    const start = performance.now();
    await dockerOutput(['container', 'kill', '--signal', 'SIGTERM', this.name], { signal: this.signal });
    const code = await this.exited();
    return { code, duration: performance.now() - start, logs: await this.logs() };
  }
}
