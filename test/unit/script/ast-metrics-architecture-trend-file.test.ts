import assert from 'node:assert/strict';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { trendOfStore } = await import(new URL('architecture/trend-store.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/trend-store.ts');
const record = { version: 1 as const, commit: 'c'.repeat(40), date: '2026-10-18T09:00:00+02:00', modularity: 0.5, crossShare: 0.2, cycles: 0, paths: 2, files: 1, functions: 1, communities: [] };

const valid = { version: 1, commit: 'deadbeefdeadbeef'.padEnd(40, '0'), date: '2026-10-17T12:00:00+02:00', modularity: 0.5, crossShare: 0.25, cycles: 0, paths: 30, files: 2, functions: 3, communities: [] };

for (const [name, text] of [
  ['text that is not JSON', 'Record'],
  ['a JSON array', '[]'],
  ['a record of version 2', JSON.stringify({ ...valid, version: 2 })],
  ['a record without a commit', JSON.stringify({ ...valid, commit: undefined })],
  ['a record without a date', JSON.stringify({ ...valid, date: undefined })],
  ['a date without a time', JSON.stringify({ ...valid, date: '2026-10-17' })],
  ['a date that is not a date', JSON.stringify({ ...valid, date: '2026-13-45T99:00:00+02:00' })],
  ['a modularity that is text', JSON.stringify({ ...valid, modularity: '0.5' })],
  ['a record without a cross share', JSON.stringify({ ...valid, crossShare: undefined })],
  ['a record without the count of the cycles', JSON.stringify({ ...valid, cycles: undefined })],
  ['a numeric tool version', JSON.stringify({ ...valid, tool: 43 })],
  ['an empty tool version', JSON.stringify({ ...valid, tool: '' })],
] as const) {
  test(`Given a record file with ${name}, when the record goes to the store, then the store fails with a diagnostic that names the file and writes no file`, (t) => {
    const folder = dataDirectory(t);
    writeFileSync(join(folder, '2026-10-17-deadbeef.json'), text);

    assert.throws(() => trendOfStore(folder, record), { message: `The file ${join(folder, '2026-10-17-deadbeef.json')} is not a valid trend file of version 1.` });
    assert.deepEqual(readdirSync(folder), ['2026-10-17-deadbeef.json']);
  });
}
