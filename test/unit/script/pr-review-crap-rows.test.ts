import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { crapRowsOf } = await import(new URL('crap-rows.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/crap-rows.ts');

const commits = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
const row = { file: 'src/a.ts', function: 'run', change: 'new', paths: 3 };

function writeCrapFile(t: TestContext, content: unknown): string {
  const path = join(dataDirectory(t), 'crap.json');
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}

test('Given the rows of the CRAP command for HEAD, when they are read, then each row keeps its file, function, change, paths, and share, and other fields do not count', (t) => {
  const path = writeCrapFile(t, {
    version: 1, ...commits, tool: '0.43.1',
    rows: [
      { ...row, identity: '{"name":"run"}' },
      { file: 'src/a.ts', function: 'parse', change: 'changed', paths: 5, share: 0.0000133, crap: 29.999002513266692, note: 'x' },
      { file: 'src/b.ts', function: '(anonymous)', change: 'unknown', paths: 0, share: 0, crap: 0 },
      { file: 'src/b.ts', function: 'old', change: 'unchanged', paths: 35, share: 1, crap: 35 },
    ],
  });

  assert.deepEqual(crapRowsOf(path, { mergeBase: commits.base, head: commits.head }), [
    row,
    { file: 'src/a.ts', function: 'parse', change: 'changed', paths: 5, share: 0.0000133 },
    { file: 'src/b.ts', function: '(anonymous)', change: 'unknown', paths: 0, share: 0 },
    { file: 'src/b.ts', function: 'old', change: 'unchanged', paths: 35, share: 1 },
  ]);
});

test('Given rows of another commit, when they are read, then the diagnostic names the file and both commits', (t) => {
  const path = writeCrapFile(t, { version: 1, base: commits.base, head: commits.base, rows: [] });

  assert.throws(() => crapRowsOf(path, { mergeBase: commits.base, head: commits.head }), {
    message: `The CRAP file ${path} is of commit ${commits.base}, but the candidate is ${commits.head}. Run the CRAP command with --json again after the last commit.`,
  });
});

for (const [name, content, message] of [
  ['that is not JSON', 'not json', 'version: give 1'],
  ['of version 2', { version: 2, ...commits, rows: [] }, 'version: give 1'],
  ['without a base', { version: 1, head: commits.head, rows: [] }, 'base: give a text'],
  ['without a head', { version: 1, base: commits.base, rows: [] }, 'head: give a text'],
  ['without rows', { version: 1, ...commits }, 'rows: give a list'],
  ['with a row that is a text', { version: 1, ...commits, rows: ['src/a.ts'] }, 'rows[0].file: give a non-empty text'],
  ['with an empty function', { version: 1, ...commits, rows: [row, { ...row, function: '' }] }, 'rows[1].function: give a non-empty text'],
  ['with another change', { version: 1, ...commits, rows: [{ ...row, change: 'moved' }] }, 'rows[0].change: give new, changed, unchanged, or unknown'],
  ['with negative paths', { version: 1, ...commits, rows: [{ ...row, paths: -1 }] }, 'rows[0].paths: give a whole number, 0 or more'],
  ['with fractional paths', { version: 1, ...commits, rows: [{ ...row, paths: 2.5 }] }, 'rows[0].paths: give a whole number, 0 or more'],
  ['with a share above 1', { version: 1, ...commits, rows: [{ ...row, share: 1.01 }] }, 'rows[0].share: give a number from 0 to 1, or leave it out'],
  ['with a share of null', { version: 1, ...commits, rows: [{ ...row, share: null }] }, 'rows[0].share: give a number from 0 to 1, or leave it out'],
  ['with a CRAP that is a text', { version: 1, ...commits, rows: [{ ...row, share: 1, crap: '3' }] }, 'rows[0].crap: give a finite number, or leave it out'],
  ['with an identity that is a number', { version: 1, ...commits, rows: [{ ...row, identity: 1 }] }, 'rows[0].identity: give a text, or leave it out'],
] as const) {
  test(`Given a CRAP file ${name}, when it is read, then the diagnostic names the file and the key`, (t) => {
    const path = writeCrapFile(t, content);

    assert.throws(() => crapRowsOf(path, { mergeBase: commits.base, head: commits.head }), { message: `The CRAP file ${path} has no valid key ${message}.` });
  });
}

test('Given a CRAP file that does not exist, when it is read, then the diagnostic names the file', (t) => {
  const path = join(dataDirectory(t), 'missing.json');

  assert.throws(() => crapRowsOf(path, { mergeBase: commits.base, head: commits.head }), { message: `Cannot read the CRAP file ${path}.` });
});

test('Given rows that the CRAP command compared with another base, when they are read, then the check refuses them and names both commits', (t) => {
  const path = writeCrapFile(t, { version: 1, base: 'c'.repeat(40), head: commits.head, rows: [] });
  assert.throws(() => crapRowsOf(path, { mergeBase: commits.base, head: commits.head }), {
    message: `The CRAP file ${path} compares with ${'c'.repeat(40)}, but the merge base is ${commits.base}. Run the CRAP command with the same --base as the check.`,
  });
});
