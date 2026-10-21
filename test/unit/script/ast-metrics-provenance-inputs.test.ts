import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const { inputIdentityOf } = await import(new URL('provenance/inputs.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/inputs.ts');

function tree(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'coverage-inputs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
for (const path of ['src/coverage/a.ts', 'script/code-quality/coverage/input.ts', 'test/fixtures/dist/example.js', 'src/a.ts', 'test/support/fixtures/page.html', 'test/unit/a.test.ts', 'pnpm-lock.yaml', 'tsconfig.build.json', 'docs/lightpanda-runtime.md', 'migrations/auth-local/a.sql']) {
  test(`Given ${path}, when its content changes, then coverage input identity changes`, (t) => {
    const root = tree(t);
    write(root, path, 'before');
    const before = inputIdentityOf(root);
    write(root, path, 'after');
    assert.notEqual(inputIdentityOf(root).inputsFingerprint, before.inputsFingerprint);
  });
}
test('Given two trees in different creation order, when hashed, then framing is stable and unrelated prose is excluded', (t) => {
  const first = tree(t), second = tree(t);
  for (const path of ['src/z.ts', 'src/a.ts']) write(first, path, path);
  for (const path of ['src/a.ts', 'src/z.ts']) write(second, path, path);
  write(first, 'README.md', 'prose');
  write(first, 'script/README.md', 'prose');
  write(first, 'src/user-portal/dist/app.js', 'generated');
  write(first, 'ast-report/coverage.json', 'generated');
  assert.deepEqual(inputIdentityOf(first), inputIdentityOf(second));
});
test('Given a symlink to an external fixture, when its target changes, then identity changes and cycles fail', (t) => {
  const root = tree(t), external = tree(t);
  write(external, 'page', 'before');
  mkdirSync(join(root, 'test'));
  symlinkSync(join(external, 'page'), join(root, 'test/page'));
  const before = inputIdentityOf(root);
  write(external, 'page', 'after');
  assert.notEqual(inputIdentityOf(root).inputsFingerprint, before.inputsFingerprint);
  symlinkSync(root, join(root, 'test/cycle'));
  assert.throws(() => inputIdentityOf(root), /cycle/);
});

test('Given file additions and removals, when hashed, then identity tracks both without Git', (t) => {
  const root = tree(t);
  const empty = inputIdentityOf(root);
  write(root, 'test/fixture.bin', 'new');
  assert.notEqual(inputIdentityOf(root).inputsFingerprint, empty.inputsFingerprint);
  rmSync(join(root, 'test/fixture.bin'));
  assert.deepEqual(inputIdentityOf(root), empty);
});
test('Given an input executable mode change, when hashed, then identity changes', (t) => {
  const root = tree(t);
  write(root, 'script/tool.sh', '#!/bin/sh');
  chmodSync(join(root, 'script/tool.sh'), 0o644);
  const before = inputIdentityOf(root);
  chmodSync(join(root, 'script/tool.sh'), 0o755);
  assert.notEqual(inputIdentityOf(root).inputsFingerprint, before.inputsFingerprint);
});
test('Given a dangling input symlink, when hashed, then fingerprinting fails', (t) => {
  const root = tree(t);
  mkdirSync(join(root, 'test'));
  symlinkSync('missing', join(root, 'test/link'));
  assert.throws(() => inputIdentityOf(root), /Cannot fingerprint inputs/);
});

for (const generated of ['src/interfaces/user-portal/dist/assets/app.js', 'src/interfaces/user-portal/.vite/cache.json']) {
  test(`Given generated portal output at ${generated}, when it changes, then source and input fingerprints stay unchanged`, (t) => {
    const root = tree(t);
    write(root, 'src/interfaces/user-portal/main.ts', 'export const portal = true;');
    const before = inputIdentityOf(root);
    write(root, generated, 'first output');
    assert.deepEqual(inputIdentityOf(root), before);
    write(root, generated, 'new output');
    assert.deepEqual(inputIdentityOf(root), before);
  });
}

test('Given architecture policy and adjacent prose, when the policy changes, then only the input fingerprint changes', (t) => {
  const root = tree(t);
  write(root, 'src/example.ts', 'export const example = true;');
  write(root, 'docs/implementation/pr-review-rules.yaml', 'dependency_graph: before');
  write(root, 'docs/implementation/notes.md', 'before');
  const before = inputIdentityOf(root);
  write(root, 'docs/implementation/notes.md', 'after');
  assert.deepEqual(inputIdentityOf(root), before);
  write(root, 'docs/implementation/pr-review-rules.yaml', 'dependency_graph: after');
  const after = inputIdentityOf(root);
  assert.notEqual(after.inputsFingerprint, before.inputsFingerprint);
  assert.equal(after.sourceFingerprint, before.sourceFingerprint);
});
