import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { networkBlocker, repositoryRoot } from '../../support/processes/module-paths.ts';

const runtimeNames = ['get-url-as-markdown.runtime.js', 'search-pipeline.runtime.js'];

function selects(script: string, file: string): boolean {
  return [...script.matchAll(/(?:^|&&)\s*node --test\s+([^&]+)/g)].some(([, argumentsText]) => {
    const argumentsList = argumentsText.match(/"[^"]+"|\S+/g) ?? [];
    return argumentsList.some((argument) => !argument.startsWith('-') && matchesGlob(file, argument.replace(/^"|"$/g, '')));
  });
}

test('Given the package scripts, when the local renderer gates are selected, then renderer and hosted build commands run both fetch and search runtime files and hosted search public, capacity, and shutdown cases', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8')) as { scripts: Record<string, string> };
  const runtimeFiles = runtimeNames.map((name) => `dist/test/acceptance/mcp/${name}`);

  assert.equal(scripts['test:mcp:renderer'], `npm run build && node --test ${runtimeFiles.join(' ')}`);
  assert.ok(scripts['build:hosted'].endsWith(`&& node --test ${runtimeFiles.join(' ')}`), 'build:hosted must run both complete runtime files in its last phase');
  for (const file of [...runtimeFiles, ...['search-pipeline.test.js', 'hosted-search-capacity.test.js', 'search-lifecycle.test.js'].map((name) => `dist/test/acceptance/mcp/${name}`)]) {
    assert.ok(selects(scripts['build:hosted'], file), `build:hosted does not select ${file}`);
  }
  for (const name of ['test', 'test:acceptance']) {
    for (const file of runtimeFiles) assert.equal(selects(scripts[name], file), false, `${name} selects ${file}`);
  }
});

test('Given the package scripts, when the live Brave search proof is selected, then only its dedicated command builds and runs the live file', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8')) as { scripts: Record<string, string> };
  const liveFile = 'dist/test/acceptance/mcp/search-pipeline.live.js';

  assert.equal(scripts['test:mcp:search:live'], `npm run build && node --test ${liveFile}`);
  for (const [name, script] of Object.entries(scripts)) {
    if (name === 'test:mcp:search:live') continue;
    assert.equal(selects(script, liveFile), false, `${name} selects ${liveFile}`);
    assert.ok(!script.includes('npm run test:mcp:search:live'), `${name} starts the live search proof`);
  }
});

// The gate runs as its own test run. A child that gets NODE_TEST_CONTEXT from this run skips the gate file.
function runGate(name: string, lightpanda: string | undefined): { status: number | null; report: string } {
  const environment: Record<string, string | undefined> = { ...process.env, LIGHTPANDA_BIN: lightpanda };
  delete environment.NODE_TEST_CONTEXT;
  if (lightpanda === undefined) delete environment.LIGHTPANDA_BIN;
  const result = spawnSync(process.execPath, ['--import', networkBlocker, '--test', '--test-reporter=tap', fileURLToPath(new URL(name, import.meta.url))], { env: environment, encoding: 'utf8', timeout: 60_000 });
  return { status: result.status, report: `${result.stdout}${result.stderr}` };
}

for (const name of [...runtimeNames, 'search-pipeline.live.js']) {
  test(`Given LIGHTPANDA_BIN is unset, relative, a missing file, or an unsupported Lightpanda version, when ${name} runs, then shared setup validation fails before network access, and no gate test passes, is skipped, or is left as todo`, { timeout: 120_000 }, (t) => {
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
      const { status, report } = runGate(name, lightpanda);

      assert.notEqual(status, 0, `${label}:\n${report}`);
      assert.match(report, message, label);
      assert.match(report, /^# pass 0$/m, `${label}:\n${report}`);
      assert.match(report, /^# skipped 0$/m, label);
      assert.match(report, /^# todo 0$/m, label);
      assert.doesNotMatch(report, /^# tests 0$/m, label);
      assert.doesNotMatch(report, /Outbound network access attempted/, label);
    }
  });
}
