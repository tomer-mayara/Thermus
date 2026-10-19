import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { MapSnapshot } from '../../../script/code-quality/architecture/types.ts';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const scriptFolder = pathToFileURL(astMetricsArchitectureScript);
const { snapshotInFile } = await import(new URL('architecture/file.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/file.ts');
const { coverageOfRepository } = await import(new URL('architecture/coverage.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/coverage.ts');
const { trendNumbersInFile } = await import(new URL('architecture/trend-file.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/trend-file.ts');
const { changesInFile } = await import(new URL('architecture/changes.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/changes.ts');

const snapshot: MapSnapshot = {
  commit: 'abc', date: '2026-10-18T12:00:00Z', communities: [], files: [],
  global: { modularity: 0, crossShare: 0, cycles: [], paths: 0, files: 0, functions: 0 },
};

const readers = [
  ['snapshot', snapshotInFile, 'not a valid snapshot of version 1'],
  ['coverage', (path: string) => coverageOfRepository(undefined, path), 'not a valid coverage report of version 1 or 2'],
  ['trend', trendNumbersInFile, 'not a valid trend file of version 1'],
  ['changes', (path: string) => changesInFile(path, snapshot, snapshot), 'not valid change metadata of version 1'],
] as const;

for (const [kind, read, invalid] of readers) {
  test(`Given a missing ${kind} file, when its reader runs, then the read diagnostic names its kind and path`, (t) => {
    const path = `${dataDirectory(t)}/missing.json`;
    assert.throws(() => read(path), { message: `Cannot read the ${kind} file ${path}.` });
  });

  for (const text of ['{', '[]', 'null', '{}']) {
    test(`Given ${text} in a ${kind} file, when its reader runs, then its schema diagnostic names the path`, (t) => {
      const path = `${dataDirectory(t)}/invalid.json`;
      writeFileSync(path, text);
      assert.throws(() => read(path), { message: `The file ${path} is ${invalid}.` });
    });
  }
}
