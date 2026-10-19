import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const folder = pathToFileURL(astMetricsCoverageScript);
const { selectedSuites, suiteCommands } = await import(new URL('coverage/suites.ts', folder).href) as typeof import('../../../script/code-quality/coverage/suites.ts');

test('Given repeated suites in request order, when selected, then unit is the default and duplicates keep their first position', () => {
  assert.deepEqual(selectedSuites(), ['unit']);
  assert.deepEqual(selectedSuites(['acceptance', 'unit', 'acceptance', 'integration', 'unit']), ['acceptance', 'unit', 'integration']);
  assert.throws(() => selectedSuites(['interface']), /--suite/);
});
for (const script of [undefined, 'node --test dist/test/unit/a.test.js', 'npm run build && npm run test:acceptance', 'npm run check && node --test dist/test/unit/a.test.js', 'npm run build && node --test dist/test/**/*.test.js', 'npm run build && node --test dist/test/unit/a.test.js dist/test/acceptance/b.test.js', 'npm run build && node --test dist/test/unit/a.test.js; npm test']) {
  test(`Given unsupported package selection ${script}, when selected, then collection is deferred before launch`, (t) => {
    const root = dataDirectory(t);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'test:unit': script } }));
    assert.throws(() => suiteCommands(root, 'unit'), /deferred/);
  });
}
test('Given the package acceptance selection, when read, then the hosted image exclusion and portal part stay exact', (t) => {
  const root = dataDirectory(t);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'test:acceptance': 'npm run build && node --test "dist/test/acceptance/**/!(hosted-image).test.js" && node --test "test/acceptance/user-portal/**/*.test.ts"' } }));
  assert.deepEqual(suiteCommands(root, 'acceptance'), [['--test', 'dist/test/acceptance/**/!(hosted-image).test.js'], ['--test', 'test/acceptance/user-portal/**/*.test.ts']]);
});

const { assertCompleteCapture } = await import(new URL('coverage/completeness.ts', folder).href) as typeof import('../../../script/code-quality/coverage/completeness.ts');
for (const [name, markers, captures] of [
  ['normal worker shutdown', [{ pid: 42, threadId: 1, complete: true }], ['coverage-42-100-1.json']],
  ['a missing shutdown', [{ pid: 42, threadId: 0, complete: false }], ['coverage-42-100-0.json']],
  ['a different thread flush', [{ pid: 42, threadId: 1, complete: true }], ['coverage-42-100-0.json']],
  ['an untracked child flush', [{ pid: 42, threadId: 0, complete: true }], ['coverage-42-100-0.json', 'coverage-43-100-0.json']],
  ['duplicate process evidence', [{ pid: 42, threadId: 0, complete: true }, { pid: 42, threadId: 0, complete: true }], ['coverage-42-100-0.json']],
  ['an unflushed worker', [{ pid: 42, threadId: 0, complete: true }, { pid: 42, threadId: 1, complete: false }], ['coverage-42-100-0.json']],
] as const) {
  test(`Given ${name}, when capture completeness is checked, then only matching normal shutdown evidence verifies`, (t) => {
    const root = dataDirectory(t);
    markers.forEach((marker, index) => writeFileSync(join(root, `process-${index}.json`), JSON.stringify(marker)));
    captures.forEach((file) => writeFileSync(join(root, file), '{}'));
    if (name === 'normal worker shutdown') assert.doesNotThrow(() => assertCompleteCapture(root));
    else assert.throws(() => assertCompleteCapture(root), /Incomplete captures are unverified/);
  });
}

const { coverageOfRepository } = await import(new URL('architecture/coverage.ts', folder).href) as typeof import('../../../script/code-quality/architecture/coverage.ts');
for (const [suite, valid] of [['unit', true], [['unit', 'acceptance'], true], [['acceptance'], true], [[], false], [['unit', 'unit'], false], [['unit', 'interface'], false], [1, false]] as const) {
  test(`Given report suite contract ${JSON.stringify(suite)}, when read, then the reader explicitly validates string and array contracts`, (t) => {
    const path = join(dataDirectory(t), 'report.json');
    writeFileSync(path, JSON.stringify({ version: 2, suite, files: [] }));
    if (valid) assert.deepEqual(coverageOfRepository(undefined, path)?.suite, suite);
    else assert.throws(() => coverageOfRepository(undefined, path), /not a valid coverage report/);
  });
}

test('Given four incomplete child captures in arbitrary file order, when completeness is checked, then the diagnostic names the first three sorted process and thread identities and the remaining count', (t) => {
  const root = dataDirectory(t);
  for (const pid of [45, 43, 42, 44]) writeFileSync(join(root, `process-${pid}.json`), JSON.stringify({ pid, threadId: pid === 43 ? 1 : 0, complete: false }));
  assert.throws(() => assertCompleteCapture(root), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /4 process\/thread identities/);
    assert.match(error.message, /pid 42\/thread 0, pid 43\/thread 1, pid 44\/thread 0 \(\+1 more\)/);
    assert.match(error.message, /Incomplete captures are unverified/);
    return true;
  });
});
