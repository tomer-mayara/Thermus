import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { blobsAt } = await import(new URL('blobs.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/blobs.ts');

test('Given a commit, when files are read with one git cat-file process, then each file gives its text by its byte size, and a missing path or a folder gives none', (t) => {
  const root = realpathSync(dataDirectory(t));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' });
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), 'const word = "Grüße";\nexport {};\n');
  writeFileSync(join(root, 'src/empty.ts'), '');
  git('init', '--quiet', '--initial-branch=main');
  git('-c', 'user.name=Thermus Test', '-c', 'user.email=thermus-test@example.com', 'add', '--all');
  git('-c', 'user.name=Thermus Test', '-c', 'user.email=thermus-test@example.com', 'commit', '--quiet', '--message', 'Start');

  assert.deepEqual(blobsAt(root, 'HEAD', ['src/a.ts', 'src/gone.ts', 'src', 'src/empty.ts']), new Map([
    ['src/a.ts', 'const word = "Grüße";\nexport {};\n'],
    ['src/empty.ts', ''],
  ]));
  assert.deepEqual(blobsAt(root, 'HEAD', []), new Map());
});
