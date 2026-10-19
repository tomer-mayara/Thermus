import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const { coverageInFile } = await import(new URL('architecture/coverage.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/coverage.ts');

for (const functions of [[], [{ name: 'run', coveredShare: 1 }]]) {
  test(`Given an unmeasured run and ${functions.length} measured namesake, when the report is read, then it preserves the file and withholds a guessed share`, (t) => {
    const path = join(dataDirectory(t), 'coverage.json');
    writeFileSync(path, JSON.stringify({ version: 1, files: [{ path: 'src/a.ts', functions }], unmeasuredFunctions: [{ path: 'src/a.ts', name: 'run', start: 0, end: 100, reason: 'no-own-characters' }] }));
    assert.deepEqual(coverageInFile(path).files, [{ path: 'src/a.ts', functions: [] }]);
  });
}
