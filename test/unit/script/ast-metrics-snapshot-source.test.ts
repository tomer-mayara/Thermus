import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const { sourceTextsOf } = await import(new URL('snapshot/source.ts', pathToFileURL(astMetricsSnapshotScript)).href) as typeof import('../../../script/code-quality/snapshot/source.ts');

for (const kind of ['file', 'folder'] as const) {
  test(`Given a source ${kind} symlink, when source text is acquired, then the snapshot fails without following the link`, (t) => {
    const root = dataDirectory(t);
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'external'));
    writeFileSync(join(root, 'external/value.ts'), 'export const value = 1;');
    const path = kind === 'file' ? 'src/value.ts' : 'src/link/value.ts';
    symlinkSync(join(root, kind === 'file' ? 'external/value.ts' : 'external'), join(root, kind === 'file' ? 'src/value.ts' : 'src/link'));
    assert.throws(() => sourceTextsOf(root, [path]), { message: `Cannot read source evidence for ${path}. No snapshot was published.` });
  });
}

test('Given a path outside src, when source text is acquired, then the snapshot refuses it', (t) => {
  const root = dataDirectory(t);
  writeFileSync(join(root, 'outside.ts'), '');
  assert.throws(() => sourceTextsOf(root, ['outside.ts']));
});

test('Given regular source files, when source text is acquired, then the supplied text is returned', (t) => {
  const root = dataDirectory(t);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/value.ts'), 'export const value = 1;');
  assert.deepEqual(sourceTextsOf(root, ['src/value.ts']), new Map([['src/value.ts', 'export const value = 1;']]));
});
