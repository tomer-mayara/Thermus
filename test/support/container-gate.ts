import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { docker, dockerOutput, type DockerResult } from './docker-cli.ts';

export const containerDataDirectory = '/var/lib/magumagu';
export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const gateRun = randomBytes(4).toString('hex');
// Each resource of this test run has this label, so the cleanup finds it also after a failed step.
export const gateLabel = `magumagu.container-gate=${gateRun}`;

const probeScript = fileURLToPath(new URL('./container-probe.js', import.meta.url));
const engineChecks = [['version', '--format', '{{.Server.Version}}'], ['buildx', 'version'], ['compose', 'version']];

export interface GateImages {
  readonly current: string;
  // The same build with another revision label: another image with the same content, as an update gives.
  readonly rebuilt: string;
}

export async function requireContainerEngine(): Promise<void> {
  for (const args of engineChecks) {
    const result = await docker(args).catch((error: unknown): DockerResult => ({ code: null, stdout: Buffer.alloc(0), stderr: String(error) }));
    if (result.code !== 0) {
      throw new Error(`The container gate needs the docker CLI, a running Docker engine, Buildx, and Compose. "docker ${args[0]}" failed:\n${result.stderr}`);
    }
  }
}

export async function buildGateImages(): Promise<GateImages> {
  await requireContainerEngine();
  return { current: await buildImage('current'), rebuilt: await buildImage('rebuilt') };
}

async function buildImage(revision: string): Promise<string> {
  const tag = `magumagu-container-gate:${gateRun}-${revision}`;
  const labels = ['--label', gateLabel, '--label', `org.opencontainers.image.revision=${revision}`];
  const result = await docker(['build', '--quiet', ...labels, '--tag', tag, repositoryRoot]);
  assert.equal(result.code, 0, `The image build failed:\n${result.stderr}`);
  return tag;
}

export async function removeGateResources(): Promise<void> {
  await removeLabelled(gateLabel);
  const images = await labelled(['image', 'ls'], gateLabel);
  if (images.length > 0) await dockerOutput(['image', 'rm', '--force', ...images]);
}

export async function removeLabelled(label: string): Promise<void> {
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

export async function probeImage<T>(image: string, probe: string, volume?: string): Promise<T> {
  const mount = volume === undefined ? [] : ['--volume', `${volume}:${containerDataDirectory}`];
  const args = ['container', 'run', '--rm', '--interactive', '--label', gateLabel, '--network', 'none', ...mount, '--env', `PROBE=${probe}`];
  const output = await dockerOutput([...args, '--entrypoint', 'node', image, '--input-type=module', '-'], { input: readFileSync(probeScript) });
  return JSON.parse(output) as T;
}
