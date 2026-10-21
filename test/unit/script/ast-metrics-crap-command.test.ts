import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const { commandOf } = await import(new URL('crap/command-line.ts', pathToFileURL(astMetricsCrapScript)).href) as typeof import('../../../script/code-quality/crap/command-line.ts');

test('Given no options, when the CRAP command line is read, then it selects the approved goals and changed source files', () => {
  assert.deepEqual(commandOf([]), { kind: 'report', base: 'origin/main', coverage: undefined, limit: 30, target: 15, paths: [], allowToolVersion: false });
});

for (const value of ['NaN', 'Infinity', '0', '-1', '15.0000001', '1e2', '9007199254740992']) {
  test(`Given threshold ${value}, when the command line is read, then it rejects unsupported precision or nonpositive values`, () => {
    assert.throws(() => commandOf([`--limit=${value}`]), /finite positive decimal/);
  });
}

test('Given equal or reversed goals, when the command line is read, then it rejects them', () => {
  assert.throws(() => commandOf(['--limit', '15']), /target must be less than/);
});

test('Given decimal goals and explicit paths, when the command line is read, then it keeps the base and version override', () => {
  assert.deepEqual(commandOf(['--base', 'main', '--limit', '30.000001', '--target', '0.000001', '--allow-tool-version', 'src/a.ts']), {
    kind: 'report', base: 'main', coverage: undefined, limit: 30.000001, target: 0.000001, paths: ['src/a.ts'], allowToolVersion: true,
  });
});

test('Given an option-like or empty base, when the command line is read, then it rejects the ref before Git', () => {
  assert.throws(() => commandOf(['--base=-main']), /must name a ref/);
  assert.throws(() => commandOf(['--base= ']), /must name a ref/);
});
