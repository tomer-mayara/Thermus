import type { GoalFunction } from '../../../script/code-quality/crap/types.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const { crapJsonOf, writeCrapJson } = await import(new URL('crap/json.ts', pathToFileURL(astMetricsCrapScript)).href) as typeof import('../../../script/code-quality/crap/json.ts');

const commits = { base: 'a'.repeat(40), head: 'b'.repeat(40) };

test('Given measured, unmeasured and unidentified rows in table order, when the JSON is made, then each row keeps its order and leaves out what the table shows as unknown', () => {
  const rows: GoalFunction[] = [
    { file: 'src/a.ts', name: 'run', paths: 20, share: 0.5, crap: 70, change: 'new', identity: '{"name":"run"}' },
    { file: 'src/a.ts', name: 'edge', paths: 5, share: 1e-320, crap: 30, change: 'changed', identity: '{"name":"edge"}' },
    { file: 'src/b.ts', name: '(anonymous)', paths: 8, share: undefined, crap: 8, change: 'unknown', identity: 'metric:0' },
  ];

  const text = crapJsonOf(commits, rows);

  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(text), {
    version: 1, base: commits.base, head: commits.head,
    rows: [
      { file: 'src/a.ts', function: 'run', change: 'new', paths: 20, share: 0.5, crap: 70, identity: '{"name":"run"}' },
      { file: 'src/a.ts', function: 'edge', change: 'changed', paths: 5, share: 1e-320, crap: 30, identity: '{"name":"edge"}' },
      { file: 'src/b.ts', function: '(anonymous)', change: 'unknown', paths: 8 },
    ],
  });
  assert.deepEqual(Object.keys(JSON.parse(text).rows[0]), ['file', 'function', 'change', 'paths', 'share', 'crap', 'identity']);
});

test('Given no rows, when the JSON is made, then it still names both commits', () => {
  assert.deepEqual(JSON.parse(crapJsonOf(commits, [])), { version: 1, base: commits.base, head: commits.head, rows: [] });
});

test('Given a file in a folder that does not exist, when the JSON is written, then the folder is made and the file holds the text', (t) => {
  const file = join(dataDirectory(t), 'report', 'crap.json');

  writeCrapJson(file, '{}\n');

  assert.equal(readFileSync(file, 'utf8'), '{}\n');
});

test('Given a file path that names a folder, when the JSON is written, then the diagnostic names the file', (t) => {
  const folder = dataDirectory(t);

  assert.throws(() => writeCrapJson(folder, '{}\n'), { message: `Cannot write the CRAP rows to ${folder}.` });
});
