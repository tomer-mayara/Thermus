import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { SnapshotSources } from '../../../script/code-quality/snapshot/build.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const folder = pathToFileURL(astMetricsSnapshotScript);
const { snapshotOf } = await import(new URL('snapshot/build.ts', folder).href) as typeof import('../../../script/code-quality/snapshot/build.ts');
const { snapshotInFile } = await import(new URL('architecture/file.ts', folder).href) as typeof import('../../../script/code-quality/architecture/file.ts');
const sources: SnapshotSources = {
  commit: 'a'.repeat(40), date: '2026-10-18T00:00:00-06:00',
  files: [], communities: '{}', functions: new Map(),
};

for (const title of ['Show trends (#214)', '', 'Title | with\nline break', undefined]) {
  test(`Given title ${JSON.stringify(title)}, when a snapshot is built and read offline, then its title stays unchanged without Git`, (t) => {
    const snapshot = snapshotOf({ ...sources, title });
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify(snapshot));

    assert.equal(snapshot.title, title);
    assert.equal(snapshotInFile(path).title, title);
    assert.equal('title' in JSON.parse(JSON.stringify(snapshot)), title !== undefined);
  });
}

for (const title of [null, 214, true, [], {}]) {
  test(`Given a snapshot with title type ${typeof title}, when it is read, then the reader rejects its declared title`, (t) => {
    const path = join(dataDirectory(t), 'snapshot.json');
    writeFileSync(path, JSON.stringify({ ...snapshotOf(sources), title }));

    assert.throws(() => snapshotInFile(path), /not a valid snapshot/);
  });
}
