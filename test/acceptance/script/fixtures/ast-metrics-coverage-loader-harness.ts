import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../../support/processes/module-paths.ts';
import { runScript } from '../../../support/processes/script-command.ts';
import { loaderCaptureFiles } from './ast-metrics-coverage-loader.ts';
import { GitRepository } from './git-repository.ts';

export type CoverageReport = {
  readonly suite: string;
  readonly commit: string;
  readonly provenance: { readonly status: string; readonly captureId: string; readonly capturedCommit: string };
  readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly called: number }[] }[];
};
export type ProcessMarker = { readonly pid: number; readonly threadId: number; readonly ownerThreadId: number; readonly state: string };

export function lifecyclePreload(mode: 'import' | 'require' = 'import'): string {
  const lifecycle = new URL('coverage/lifecycle.ts', pathToFileURL(astMetricsCoverageScript));
  return `--${mode}=${mode === 'import' ? lifecycle.href : fileURLToPath(lifecycle)}`;
}

export async function capturedLoader(t: TestContext, files = loaderCaptureFiles(lifecyclePreload())) {
  const repository = GitRepository.create(t);
  repository.commit('Start loader capture', files);
  mkdirSync(join(repository.root, 'node_modules'));
  symlinkSync(dirname(fileURLToPath(import.meta.resolve('tsx/package.json'))), join(repository.root, 'node_modules/tsx'));
  const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });
  assert.equal(result.code, 0, result.stderr);
  const report = reportOf(repository);
  assert.equal(report.suite, 'unit');
  assert.equal(report.provenance.status, 'verified');
  assert.equal(report.commit, report.provenance.capturedCommit);
  const archives = readdirSync(join(repository.root, 'ast-report/coverage-captures'));
  assert.equal(archives.length, 1);
  const archive = join(repository.root, 'ast-report/coverage-captures', archives[0]);
  return { repository, report, archive };
}

export function reportOf(repository: GitRepository): CoverageReport {
  return JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8')) as CoverageReport;
}

export function loaderParticipants(archive: string): readonly ProcessMarker[] {
  const names = readdirSync(archive);
  const markers = names.filter((name) => name.startsWith('process-')).map((name) => JSON.parse(readFileSync(join(archive, name), 'utf8')) as ProcessMarker);
  const loaders = names.filter((name) => /^coverage-\d+-\d+-[1-9]\d*\.json$/.test(name)).filter((name) => {
    const raw = JSON.parse(readFileSync(join(archive, name), 'utf8')) as { result: { url: string }[] };
    return raw.result.some(({ url }) => url === 'node:internal/modules/esm/worker')
      && raw.result.some(({ url }) => url.includes('/tsx/dist/esm/'));
  });
  assert.ok(loaders.length > 0, 'The capture has no real tsx loader thread.');
  return loaders.map((name) => {
    const identity = /^coverage-(\d+)-\d+-(\d+)\.json$/.exec(name);
    assert.ok(identity !== null, `The loader has an invalid raw file identity: ${name}`);
    const [, pid, threadId] = identity;
    const marker = markers.find((entry) => entry.pid === Number(pid) && entry.threadId === Number(threadId) && entry.state === 'loader-parked');
    assert.ok(marker !== undefined, `The loader has no terminal participant evidence: ${name}`);
    return marker;
  });
}
