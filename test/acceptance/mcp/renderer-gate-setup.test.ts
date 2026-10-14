import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/data-directory.ts';

const rendererGate = fileURLToPath(new URL('./get-url-as-markdown.runtime.js', import.meta.url));

// The gate runs as its own test run. A child that gets NODE_TEST_CONTEXT from this run skips the gate file.
function runGate(lightpanda: string | undefined): { status: number | null; report: string } {
  const environment: Record<string, string | undefined> = { ...process.env, LIGHTPANDA_BIN: lightpanda };
  delete environment.NODE_TEST_CONTEXT;
  if (lightpanda === undefined) delete environment.LIGHTPANDA_BIN;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', rendererGate], { env: environment, encoding: 'utf8', timeout: 60_000 });
  return { status: result.status, report: `${result.stdout}${result.stderr}` };
}

test('Given LIGHTPANDA_BIN is unset, relative, a missing file, or an unsupported Lightpanda version, when the explicit renderer gate runs, then it fails with a setup error, and no gate test passes, is skipped, or is left as todo', { timeout: 120_000 }, (t) => {
  const directory = dataDirectory(t);
  const unsupported = join(directory, 'lightpanda');
  writeFileSync(unsupported, '#!/bin/sh\necho 1.1.0-nightly.10257+c3dfbaab3\n', { mode: 0o755 });
  const cases = [
    { label: 'unset', lightpanda: undefined, message: /Renderer gate setup failed: set LIGHTPANDA_BIN to the absolute path of the pinned Lightpanda 1\.0\.0 executable/ },
    { label: 'relative', lightpanda: 'lightpanda', message: /Renderer gate setup failed: LIGHTPANDA_BIN must be an absolute path/ },
    { label: 'missing', lightpanda: join(directory, 'missing-lightpanda'), message: /Renderer gate setup failed: the LIGHTPANDA_BIN executable does not run/ },
    { label: 'unsupported', lightpanda: unsupported, message: /Renderer gate setup failed: LIGHTPANDA_BIN reports Lightpanda 1\.1\.0-nightly\.10257\+c3dfbaab3; the gate supports only 1\.0\.0/ },
  ];

  for (const { label, lightpanda, message } of cases) {
    const { status, report } = runGate(lightpanda);

    assert.notEqual(status, 0, `${label}:\n${report}`);
    assert.match(report, message, label);
    assert.match(report, /^# pass 0$/m, `${label}:\n${report}`);
    assert.match(report, /^# skipped 0$/m, label);
    assert.match(report, /^# todo 0$/m, label);
    assert.doesNotMatch(report, /^# tests 0$/m, label);
  }
});
