import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { capturedLoader, lifecyclePreload, loaderParticipants } from './fixtures/ast-metrics-coverage-loader-harness.ts';
import { nestedExitEvents, nestedExitLoaderFiles, workerLoaderFiles } from './fixtures/ast-metrics-coverage-loader-exit.ts';

test('Given nested manual exit events and a late module.register exit listener, when a real tsx owner reaches normal exit, then later typed imports and synchronous loader work finish before verification', { timeout: 30_000 }, async (t) => {
  const { repository, archive } = await capturedLoader(t, nestedExitLoaderFiles(lifecyclePreload()));
  assert.equal(readFileSync(join(repository.root, 'ast-report/loader-events.log'), 'utf8'), nestedExitEvents);
  loaderParticipants(archive);
});

test('Given a real worker that owns a tsx loader, when its typed entry and delayed cleanup finish, then the loader participant names its worker owner and the capture verifies', { timeout: 30_000 }, async (t) => {
  const { report, archive } = await capturedLoader(t, workerLoaderFiles(lifecyclePreload()));
  const loaders = loaderParticipants(archive);
  assert.ok(loaders.some(({ ownerThreadId }) => ownerThreadId === 0), 'The capture has no loader owned by the main thread.');
  assert.ok(loaders.some(({ ownerThreadId }) => ownerThreadId > 0), 'The capture has no loader owned by a worker.');
  const sample = report.files.find(({ path }) => path === 'src/sample.ts');
  for (const name of ['early', 'afterEmittedExit', 'cleanup']) {
    assert.ok(sample?.functions.some((entry) => entry.name === name && entry.called > 0), JSON.stringify(sample));
  }
});
