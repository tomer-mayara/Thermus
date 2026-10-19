import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';
import * as tree from '../provenance/tree.ts';
import { inputIdentityOf } from '../provenance/inputs.ts';
import { inputIdentityIn } from '../provenance/read.ts';
import type { InputIdentity } from '../provenance/types.ts';
import { objectOf, jsonOf } from '../shared/json.ts';
import { CommandError } from '../shared/repository.ts';

const manifestName = '.coverage-build.json';
function buildFingerprintOf(root: string): string {
  return tree.fingerprintOf(tree.treeEntries(join(root, 'dist'), (path) => path !== manifestName));
}
export function assertInputs(root: string, expected: InputIdentity): void {
  if (JSON.stringify(inputIdentityOf(root)) !== JSON.stringify(inputIdentityIn(expected))) throw new CommandError('Coverage inputs changed during capture. No coverage is written.');
}
export function assertBuild(root: string, expected: string): void {
  if (buildFingerprintOf(root) !== expected) throw new CommandError('Emitted output changed during capture. No coverage is written.');
}
export function preparedBuild(root: string, identity: InputIdentity, noBuild: boolean): string {
  assertInputs(root, identity);
  if (noBuild) return verifiedBuild(root, identity);
  const result = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 2, 2] });
  if (result.error || result.status !== 0) throw new CommandError('The build failed. No coverage is written.');
  assertInputs(root, identity);
  const buildFingerprint = buildFingerprintOf(root);
  fs.writeFileSync(join(root, 'dist', manifestName), `${JSON.stringify({ version: 1, identity, buildFingerprint })}\n`);
  return buildFingerprint;
}
function verifiedBuild(root: string, identity: InputIdentity): string {
  try {
    const manifest = objectOf(jsonOf(fs.readFileSync(join(root, 'dist', manifestName), 'utf8')));
    const original = inputIdentityIn(manifest.identity);
    if (manifest.version === 1 && JSON.stringify(original) === JSON.stringify(identity) && manifest.buildFingerprint === buildFingerprintOf(root)) return manifest.buildFingerprint as string;
  } catch { /* A missing or unreadable manifest cannot prove a build. */ }
  throw new CommandError('The build manifest is missing or stale. Run coverage without --no-build.');
}
