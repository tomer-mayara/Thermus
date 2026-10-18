import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The trend store of the architecture command: the name of a record file, the text that the store writes, the rule
// that keeps the file of a commit, the files that are not records, the check of a record file, and the choice and the
// order of the last ten records. The cases give the store a folder of the test. The module runs from source next to
// the command, as the command runs it. ast-metrics-architecture-trend.test.ts specifies the record.
interface TrendNumbers {
  readonly commit: string;
  readonly date: string;
  readonly modularity: number;
  readonly crossShare: number;
  readonly cycles: number;
  readonly maintainability?: number;
  readonly functionsOver30?: number;
}

interface TrendRecord extends TrendNumbers {
  readonly version: 1;
  readonly paths: number;
  readonly files: number;
  readonly functions: number;
  readonly communities: readonly { readonly label: string; readonly files: number; readonly loc: number; readonly paths: number }[];
}

const { trendOfStore } = await import(new URL('ast-metrics-architecture-trend-store.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  trendOfStore(folder: string, base: TrendRecord): TrendNumbers[];
};

function recordOf(commit: string, date: string): TrendRecord {
  return { version: 1, commit, date, modularity: 0.47, crossShare: 0.31, cycles: 1, maintainability: 64.2, paths: 30, files: 2, functions: 3, communities: [{ label: 'alpha', files: 2, loc: 80, paths: 30 }] };
}

const record = recordOf('c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00', '2026-10-18T09:00:00+02:00');

function writeJson(folder: string, name: string, value: unknown): void {
  writeFileSync(join(folder, name), `${JSON.stringify(value, null, 2)}\n`);
}

// Writes each record under the name that the store gives it.
function writeRecords(folder: string, records: readonly TrendRecord[]): void {
  for (const entry of records) writeJson(folder, `${entry.date.slice(0, 10)}-${entry.commit.slice(0, 8)}.json`, entry);
}

test('Given an empty store and a record whose date is in a time zone east of UTC, when the record goes to the store, then the name of its file is the day of the date in the time zone of the commit, a dash, the first eight characters of the commit, and .json', (t) => {
  const folder = dataDirectory(t);

  trendOfStore(folder, { ...record, date: '2026-10-18T01:30:00+03:00' });

  assert.deepEqual(readdirSync(folder), ['2026-10-18-c0ffee00.json']);
});

test('Given a folder that does not exist, when the record goes to the store, then the store makes the folder and writes the record as JSON with two spaces and a newline at the end, and gives the record as the only row', (t) => {
  const folder = join(dataDirectory(t), 'docs', 'metrics');

  const rows = trendOfStore(folder, record);

  assert.deepEqual(readdirSync(folder), ['2026-10-18-c0ffee00.json']);
  assert.equal(readFileSync(join(folder, '2026-10-18-c0ffee00.json'), 'utf8'), [
    '{',
    '  "version": 1,',
    '  "commit": "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00",',
    '  "date": "2026-10-18T09:00:00+02:00",',
    '  "modularity": 0.47,',
    '  "crossShare": 0.31,',
    '  "cycles": 1,',
    '  "maintainability": 64.2,',
    '  "paths": 30,',
    '  "files": 2,',
    '  "functions": 3,',
    '  "communities": [',
    '    {',
    '      "label": "alpha",',
    '      "files": 2,',
    '      "loc": 80,',
    '      "paths": 30',
    '    }',
    '  ]',
    '}',
    '',
  ].join('\n'));
  assert.deepEqual(rows, [record]);
});

test('Given a store with a file of the same commit under another date, when the record goes to the store, then the store keeps that file as it is, writes no file, and gives the numbers of that file', (t) => {
  const folder = dataDirectory(t);
  const earlier = { ...record, date: '2026-10-01T12:00:00+02:00', modularity: 0.4, functionsOver30: 7 };
  writeRecords(folder, [earlier]);
  const text = readFileSync(join(folder, '2026-10-01-c0ffee00.json'), 'utf8');

  const rows = trendOfStore(folder, record);

  assert.deepEqual(readdirSync(folder), ['2026-10-01-c0ffee00.json']);
  assert.equal(readFileSync(join(folder, '2026-10-01-c0ffee00.json'), 'utf8'), text);
  assert.deepEqual(rows, [{ commit: earlier.commit, date: earlier.date, modularity: 0.4, crossShare: 0.31, cycles: 1, maintainability: 64.2, functionsOver30: 7 }]);
});

test('Given a store with a file of another commit, files that are not records, and a folder with the name of a record, when the record goes to the store, then the store writes the file of the record, reads no other file, and gives both records by date', (t) => {
  const folder = dataDirectory(t);
  const other = recordOf('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', '2026-10-18T08:00:00+02:00');
  writeRecords(folder, [other]);
  for (const name of ['README.md', 'notes.json', '2026-10-18-c0ffee00.json.tmp', '2026-10-18-c0ffee.json']) writeFileSync(join(folder, name), 'Not a record.\n');
  mkdirSync(join(folder, '2026-10-17-feedfeed.json'));

  const rows = trendOfStore(folder, record);

  assert.ok(readdirSync(folder).includes('2026-10-18-c0ffee00.json'));
  assert.deepEqual(rows.map(({ commit }) => commit), [other.commit, record.commit]);
});

const valid = { version: 1, commit: 'deadbeefdeadbeef', date: '2026-10-17T12:00:00+02:00', modularity: 0.5, crossShare: 0.25, cycles: 0 };

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
] as const) {
  test(`Given a record file with ${name}, when the record goes to the store, then the store fails with a diagnostic that names the file and writes no file`, (t) => {
    const folder = dataDirectory(t);
    writeFileSync(join(folder, '2026-10-17-deadbeef.json'), text);

    assert.throws(() => trendOfStore(folder, record), { message: `The file ${join(folder, '2026-10-17-deadbeef.json')} is not a valid trend file of version 1.` });
    assert.deepEqual(readdirSync(folder), ['2026-10-17-deadbeef.json']);
  });
}

test('Given a store with eleven records, when a newer record goes to the store, then the store gives the ten records with the latest dates, oldest first, with the new record last', (t) => {
  const folder = dataDirectory(t);
  const stored = Array.from({ length: 11 }, (_, index) => recordOf(`${index + 10}`.repeat(4), `2026-10-${index + 10}T12:00:00+02:00`));
  writeRecords(folder, stored);
  const newer = recordOf('c0ffee00c0ffee00', '2026-10-21T12:00:00+02:00');

  const rows = trendOfStore(folder, newer);

  assert.deepEqual(rows.map(({ commit }) => commit), [...stored.slice(2), newer].map(({ commit }) => commit));
});

// 09:00+05:00 is 06:00+02:00, so that record comes first, though its file name and the text of its date come later.
// The two records of 08:00+02:00 come in the order of their file names. The base is the record of the evening, so the
// store writes no file.
test('Given records of one day in several time zones and two records of the same time, when the record of one of them goes to the store, then the time of the date orders the records, and the file name orders the two of the same time', (t) => {
  const folder = dataDirectory(t);
  const evening = recordOf('bbbb0002bbbb0002', '2026-10-10T18:00:00+02:00');
  writeRecords(folder, [
    recordOf('aaaa0001aaaa0001', '2026-10-10T08:00:00+02:00'), evening,
    recordOf('cccc0003cccc0003', '2026-10-10T08:00:00+02:00'), recordOf('dddd0004dddd0004', '2026-10-10T09:00:00+05:00'),
  ]);

  const rows = trendOfStore(folder, evening);

  assert.deepEqual(rows.map(({ commit }) => commit), ['dddd0004dddd0004', 'aaaa0001aaaa0001', 'cccc0003cccc0003', 'bbbb0002bbbb0002']);
  assert.equal(readdirSync(folder).length, 4);
});
