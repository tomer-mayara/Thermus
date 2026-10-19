import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { MapSnapshot } from '../../../script/code-quality/architecture/types.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const folder = pathToFileURL(astMetricsArchitectureScript);
const { trendRecordsOf } = await import(new URL('architecture/trend-record.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-record.ts');
const { trendNumbersInFile } = await import(new URL('architecture/trend-file.ts', folder).href) as typeof import('../../../script/code-quality/architecture/trend-file.ts');
const snapshot: MapSnapshot = {
  commit: 'a'.repeat(40), date: '2026-10-18T00:00:00-06:00',
  global: { modularity: 0.5, crossShare: 0.2, cycles: [], files: 1, functions: 0, paths: 2 },
  files: [{ path: 'src/auth/session.ts', loc: 4, paths: 2 }], communities: [],
};

for (const title of ['Show trends (#214)', '', 'Title | with\nline break', undefined]) {
  test(`Given title ${JSON.stringify(title)}, when trend records are made and read offline, then the title and component numbers survive`, (t) => {
    const records = trendRecordsOf({ base: { ...snapshot, title }, head: { ...snapshot, title }, touched: [] }, undefined);
    const path = join(dataDirectory(t), 'record.json');
    writeFileSync(path, JSON.stringify(records.base));
    const numbers = trendNumbersInFile(path);

    assert.equal(records.base.title, title);
    assert.equal(records.head.title, title);
    assert.equal(numbers.title, title);
    assert.equal('title' in numbers, title !== undefined);
    assert.deepEqual(numbers.components, [{ name: 'auth', files: 1, loc: 4, paths: 2 }]);
  });
}

for (const title of [null, 214, true, [], {}]) {
  test(`Given a trend record with title type ${typeof title}, when it is read, then the reader rejects its declared title`, (t) => {
    const record = trendRecordsOf({ base: snapshot, head: snapshot, touched: [] }, undefined).base;
    const path = join(dataDirectory(t), 'record.json');
    writeFileSync(path, JSON.stringify({ ...record, title }));

    assert.throws(() => trendNumbersInFile(path), /not a valid trend file/);
  });
}

test('Given a legacy trend record without title or components, when it is read offline, then both values remain unknown', (t) => {
  const record = trendRecordsOf({ base: snapshot, head: snapshot, touched: [] }, undefined).base;
  const path = join(dataDirectory(t), 'record.json');
  writeFileSync(path, JSON.stringify({ ...record, components: undefined }));

  const numbers = trendNumbersInFile(path);

  assert.equal('title' in numbers, false);
  assert.equal('components' in numbers, false);
});
