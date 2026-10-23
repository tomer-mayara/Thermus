import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandError } from './command-error.ts';

export const pinnedToolVersion = '0.43.1-thermus.1';
export const upstreamCommit = 'b2f83dc17bc5f13084c163400def4d55d691f983';
export const sourceArchiveSha256 = '44c26e5c3bcb97ac4028904a89183d7ad84ab673e009a9cc3683aa8643680517';
export const pinnedGoVersion = 'go1.27.3';
export const toolRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const patchPath = join(toolRoot, 'patches/ast-metrics', `${pinnedToolVersion}.patch`);
export const runtimeDirectory = join(toolRoot, '.cache/ast-metrics', pinnedToolVersion, `${process.platform}-${process.arch}`);
export const runtimeBinary = join(runtimeDirectory, process.platform === 'win32' ? 'ast-metrics.exe' : 'ast-metrics');
export const runtimeManifest = join(runtimeDirectory, 'install.json');
export const installInstruction = 'Run pnpm exec node script/code-quality/ast-metrics-install.ts.';

export function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Resolve from these wrappers, not the analyzed tree. A base worktree can have no installer or cache.
export function astMetricsBinary(): string {
  try {
    const manifest: unknown = JSON.parse(readFileSync(runtimeManifest, 'utf8'));
    if (manifest === null || typeof manifest !== 'object') throw new Error('Invalid install manifest.');
    const facts = manifest as Record<string, unknown>;
    if (facts.format !== 1 || facts.version !== pinnedToolVersion || facts.upstreamCommit !== upstreamCommit
      || facts.sourceArchiveSha256 !== sourceArchiveSha256 || facts.goVersion !== pinnedGoVersion
      || facts.patchSha256 !== fileSha256(patchPath) || facts.binarySha256 !== fileSha256(runtimeBinary)) {
      throw new Error('The installed files do not match the pinned inputs.');
    }
    return runtimeBinary;
  } catch (error) {
    throw new CommandError(`The local ast-metrics runtime is missing or invalid. ${installInstruction} ${(error as Error).message}`);
  }
}
