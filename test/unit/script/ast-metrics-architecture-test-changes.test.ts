import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { testChangesOnlyInPaths, testChangesOnlyInRepository } from '../../../script/code-quality/architecture/test-changes.ts';

for (const [paths, expected] of [
  [[], false], [['README.md'], false], [['test/unit/work.test.ts'], true],
  [['test/support/helpers/run.sh'], true], [['test/support/fixtures/data.json', 'README.md'], true],
  [['test/support/fixtures/data.csv', 'src/page.html'], false], [['src/work.ts', 'test/unit/work.test.ts'], false],
  [['testing/data.json'], false], [['test.md'], false],
] as const) {
  test(`Given changed paths ${JSON.stringify(paths)}, when test-only changes are selected, then the result is ${expected}`, () => {
    assert.equal(testChangesOnlyInPaths(paths), expected);
  });
}

function repositoryFor(t: TestContext, path: string) {
  const root = dataDirectory(t);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' });
  mkdirSync(join(root, 'test/fixtures'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, path), 'before\n');
  writeFileSync(join(root, '.gitignore'), 'test/fixtures/ignored.json\nsrc/ignored.html\n');
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'Thermus Test');
  git('config', 'user.email', 'thermus-test@example.com');
  git('add', '--all');
  git('commit', '--quiet', '--message', 'Base');
  const base = git('rev-parse', 'HEAD').trim();
  return { root, git, base };
}

for (const state of ['committed', 'staged', 'unstaged', 'untracked', 'deleted'] as const) {
  test(`Given ${state} JSON fixture changes, when Git inputs are selected, then it is a test-only change`, (t) => {
    const path = 'test/fixtures/value.json';
    const { root, git, base } = repositoryFor(t, state === 'untracked' ? 'test/fixtures/kept.json' : path);
    if (state === 'deleted') rmSync(join(root, path));
    else writeFileSync(join(root, path), 'after\n');
    if (state === 'staged' || state === 'committed') git('add', path);
    if (state === 'committed') git('commit', '--quiet', '--message', 'Change fixture');
    assert.equal(testChangesOnlyInRepository(root, base), true);
  });
}

test('Given ignored untracked fixture and source files, when Git inputs are selected, then neither affects the result', (t) => {
  const { root, base } = repositoryFor(t, 'test/fixtures/value.json');
  writeFileSync(join(root, 'test/fixtures/ignored.json'), '{}\n');
  assert.equal(testChangesOnlyInRepository(root, base), false);
  writeFileSync(join(root, 'test/fixtures/value.json'), 'after\n');
  writeFileSync(join(root, 'src/ignored.html'), '<p>Ignored</p>\n');
  assert.equal(testChangesOnlyInRepository(root, base), true);
});

for (const state of ['committed', 'staged', 'unstaged', 'untracked', 'deleted'] as const) {
  test(`Given ${state} source asset changes and a fixture change, when Git inputs are selected, then it is not test-only`, (t) => {
    const path = 'src/page.html';
    const { root, git, base } = repositoryFor(t, state === 'untracked' ? 'src/kept.html' : path);
    if (state === 'deleted') rmSync(join(root, path));
    else writeFileSync(join(root, path), '<p>Changed</p>\n');
    if (state === 'staged' || state === 'committed') git('add', path);
    if (state === 'committed') git('commit', '--quiet', '--message', 'Change source asset');
    writeFileSync(join(root, 'test/fixtures/value.json'), '{}\n');
    assert.equal(testChangesOnlyInRepository(root, base), false);
  });
}
