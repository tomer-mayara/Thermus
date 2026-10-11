import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'magumagu-build-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const file of ['package.json', 'tsconfig.json']) cpSync(join(root, file), join(dir, file));
  if (existsSync(join(root, 'scripts'))) cpSync(join(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'test/unit'), { recursive: true });
  mkdirSync(join(dir, 'test/interface'), { recursive: true });
  writeFileSync(join(dir, 'src/current.ts'), 'export const current = true;\n');
  for (const suite of ['unit', 'interface']) writeFileSync(join(dir, `test/${suite}/current.test.ts`), `import { test } from 'node:test';\ntest('${suite} current', () => {});\n`);
  return dir;
}
function run(dir, command) {
  return spawnSync('npm', ['--prefix', dir, 'run', command], { cwd: tmpdir(), encoding: 'utf8', env: childEnv });
}
function passes(result) { assert.equal(result.status, 0, result.stdout + result.stderr); }

for (const command of ['test', 'test:unit', 'test:interface']) {
  test(`Given renamed and deleted tests, ${command} executes only current source`, (t) => {
    const dir = fixture(t);
    const suite = command === 'test:interface' ? 'interface' : 'unit';
    const old = join(dir, `test/${suite}/obsolete.test.ts`);
    writeFileSync(old, "import { test } from 'node:test';\ntest('obsolete sentinel', () => {});\n");
    passes(run(dir, 'build'));
    renameSync(old, join(dir, `test/${suite}/renamed.test.ts`));
    writeFileSync(join(dir, `test/${suite}/renamed.test.ts`), "import { test } from 'node:test';\ntest('renamed sentinel', () => {});\n");
    const renamed = run(dir, command);
    passes(renamed);
    assert.doesNotMatch(renamed.stdout, /obsolete sentinel/);
    assert.match(renamed.stdout, /renamed sentinel/);
    rmSync(join(dir, `test/${suite}/renamed.test.ts`));
    const deleted = run(dir, command);
    passes(deleted);
    assert.doesNotMatch(deleted.stdout, /obsolete sentinel|renamed sentinel/);
    assert.match(deleted.stdout, new RegExp(`${suite} current`));
    if (command === 'test') assert.match(deleted.stdout, /interface current/);
    if (command !== 'test') assert.doesNotMatch(deleted.stdout, new RegExp(`${suite === 'unit' ? 'interface' : 'unit'} current`));
    const fresh = fixture(t);
    const clean = run(fresh, command);
    passes(clean);
    assert.deepEqual(deleted.stdout.match(/(?:unit|interface) current/g), clean.stdout.match(/(?:unit|interface) current/g));
    const files = readdirSync(join(dir, 'dist'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(join(dir, 'dist').length + 1))
      .sort();
    const freshFiles = readdirSync(join(fresh, 'dist'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(join(fresh, 'dist').length + 1))
      .sort();
    assert.deepEqual(files, freshFiles);
    for (const file of files) {
      assert.deepEqual(readFileSync(join(dir, 'dist', file)), readFileSync(join(fresh, 'dist', file)));
    }
  });
}

test('Given a deleted module, repeated builds remove its output and preserve outside files', (t) => {
  const dir = fixture(t);
  const outside = join(dir, 'keep.txt');
  writeFileSync(outside, 'user data');
  writeFileSync(join(dir, 'src/obsolete.ts'), 'export const obsolete = true;\n');
  passes(run(dir, 'build'));
  assert.ok(existsSync(join(dir, 'dist/src/obsolete.js')));
  rmSync(join(dir, 'src/obsolete.ts'));
  passes(run(dir, 'build'));
  assert.equal(existsSync(join(dir, 'dist/src/obsolete.js')), false);
  assert.equal(existsSync(join(dir, 'dist/src/obsolete.js.map')), false);
  passes(run(dir, 'build'));
  assert.equal(readFileSync(outside, 'utf8'), 'user data');
  assert.ok(existsSync(join(dir, 'src/current.ts')));
});

test('Given a symlink output directory, build rejects it and preserves its target', (t) => {
  const dir = fixture(t);
  const target = mkdtempSync(join(tmpdir(), 'magumagu-outside-'));
  t.after(() => rmSync(target, { recursive: true, force: true }));
  writeFileSync(join(target, 'keep.txt'), 'user data');
  symlinkSync(target, join(dir, 'dist'));
  const rejected = run(dir, 'build');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Build output must be a directory at the project dist path/);
  assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'user data');
  assert.equal(existsSync(join(target, 'src')), false);
});

test('Given a regular file at the output path, build rejects it without deletion', (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, 'dist'), 'user data');
  const rejected = run(dir, 'build');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Build output must be a directory at the project dist path/);
  assert.equal(readFileSync(join(dir, 'dist'), 'utf8'), 'user data');
});

test('Given another working directory and configured output, build uses only the owned dist path', (t) => {
  const dir = fixture(t);
  const config = JSON.parse(readFileSync(join(dir, 'tsconfig.json'), 'utf8'));
  config.compilerOptions.outDir = 'user-output';
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(config));
  mkdirSync(join(dir, 'user-output'));
  writeFileSync(join(dir, 'user-output/keep.txt'), 'user data');
  const result = spawnSync(process.execPath, [join(dir, 'scripts/build.mjs')], { cwd: tmpdir(), encoding: 'utf8', env: childEnv });
  passes(result);
  assert.ok(existsSync(join(dir, 'dist/src/current.js')));
  assert.equal(readFileSync(join(dir, 'user-output/keep.txt'), 'utf8'), 'user data');
  assert.equal(existsSync(join(dir, 'user-output/src')), false);
});

test('Given existing output, typecheck does not emit or clear it', (t) => {
  const dir = fixture(t);
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist/keep.txt'), 'existing output');
  passes(run(dir, 'typecheck'));
  assert.equal(readFileSync(join(dir, 'dist/keep.txt'), 'utf8'), 'existing output');
  assert.equal(existsSync(join(dir, 'dist/src')), false);
});
