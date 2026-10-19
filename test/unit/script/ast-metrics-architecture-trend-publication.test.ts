import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { TrendRecord } from '../../../script/code-quality/architecture/trend-record.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const storeUrl = new URL('architecture/trend-store.ts', pathToFileURL(astMetricsArchitectureScript)).href;
const { trendOfStore } = await import(storeUrl) as typeof import('../../../script/code-quality/architecture/trend-store.ts');
const record: TrendRecord = {
  version: 1, commit: 'a'.repeat(40), date: '2026-10-18T09:00:00+02:00',
  modularity: 0.5, crossShare: 0.2, cycles: 0, paths: 2, files: 1, functions: 1, communities: [],
};

function stored(folder: string, value: TrendRecord): string {
  const path = join(folder, `${value.date.slice(0, 10)}-${value.commit.slice(0, 8)}.json`);
  writeFileSync(path, `${JSON.stringify(value)}\n`);
  return path;
}

function writer(folder: string, value: TrendRecord): Promise<number | null> {
  const code = `import {trendOfStore} from ${JSON.stringify(storeUrl)}; trendOfStore(${JSON.stringify(folder)}, ${JSON.stringify(value)});`;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', code], { stdio: 'ignore' });
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
}

test('Given full commits with one eight-character prefix, when recording the second, then a collision fails without changing the first', (t) => {
  const folder = dataDirectory(t);
  const path = stored(folder, record);
  const text = readFileSync(path, 'utf8');
  assert.throws(() => trendOfStore(folder, { ...record, commit: `${'a'.repeat(8)}${'b'.repeat(32)}` }), /prefix collision/);
  assert.equal(readFileSync(path, 'utf8'), text);
  assert.equal(readdirSync(folder).length, 1);
});

for (const kind of ['directory', 'symlink'] as const) {
  test(`Given a record-shaped ${kind}, when reading the store, then malformed history is refused`, (t) => {
    const folder = dataDirectory(t);
    const path = join(folder, '2026-10-18-aaaaaaaa.json');
    if (kind === 'directory') mkdirSync(path);
    else symlinkSync('missing.json', path);
    assert.throws(() => trendOfStore(folder), /not a regular file/);
  });
}

test('Given malformed optional coverage data in another record, when recording a base, then every stored file is validated first', (t) => {
  const folder = dataDirectory(t);
  const path = stored(folder, { ...record, commit: 'b'.repeat(40) });
  writeFileSync(path, JSON.stringify({ ...record, commit: 'b'.repeat(40), functionsOver30: '0' }));
  assert.throws(() => trendOfStore(folder, record), /not a valid trend file/);
  assert.equal(readdirSync(folder).length, 1);
});

test('Given two concurrent dates and counts for one full commit, when both writers finish, then the first complete record stays alone', async (t) => {
  const folder = dataDirectory(t);
  const other = { ...record, date: '2026-10-17T09:00:00+02:00', functionsOver30: 7 };
  assert.deepEqual(await Promise.all([writer(folder, record), writer(folder, other)]), [0, 0]);
  const names = readdirSync(folder);
  assert.equal(names.length, 1);
  const text = readFileSync(join(folder, names[0]), 'utf8');
  assert.ok([JSON.stringify(record, null, 2), JSON.stringify(other, null, 2)].includes(text.trimEnd()));
  trendOfStore(folder, { ...record, date: '2026-10-19T09:00:00+02:00' });
  assert.equal(readFileSync(join(folder, names[0]), 'utf8'), text);
});

test('Given a busy or abandoned writer lock, when recording a base, then a bounded wait fails with recovery instructions', { timeout: 8_000 }, (t) => {
  const folder = dataDirectory(t);
  mkdirSync(join(folder, '.record-lock'));
  assert.throws(() => trendOfStore(folder, record), /After confirming that no writer is active, remove this lock directory/);
  assert.deepEqual(readdirSync(folder), ['.record-lock']);
});

for (const fields of [
  { paths: -1 }, { files: '1' }, { functions: 1.5 }, { communities: 'bad' },
  { communities: [{ label: 'bad', files: 1, loc: -1, paths: 2 }] },
  { communities: [{ label: 'bad', files: 1, loc: 1, paths: 2, functionsOver30: '1' }] },
]) {
  test('Given malformed structure in history, when recording a base, then no record is added', (t) => {
    const folder = dataDirectory(t);
    const path = stored(folder, { ...record, commit: 'b'.repeat(40) });
    writeFileSync(path, JSON.stringify({ ...record, commit: 'b'.repeat(40), ...fields }));
    assert.throws(() => trendOfStore(folder, record), /not a valid trend file/);
    assert.equal(readdirSync(folder).length, 1);
  });
}
