import assert from 'node:assert/strict';
import { matchesGlob } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { anyGlobMatches, unsupportedGlob } = await import(new URL('globs.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/globs.ts');

test('Given Node 24, when path.matchesGlob meets a name that starts with a dot, then it does not match, so the check has its own matcher', () => {
  assert.equal(matchesGlob('docs/.hidden/x.md', '**'), false);
  assert.equal(matchesGlob('docs/.hidden/x.md', 'docs/**'), false);
});

for (const [pattern, path] of [
  ['.habit-hooks/**', '.habit-hooks/eslint.config.mjs'],
  ['**', 'docs/.hidden/x.md'],
  ['docs/**', 'docs/.hidden/x.md'],
  ['src/**', 'src/a/.b/c.ts'],
  ['src/**', 'src/index.ts'],
  ['src/**/*.ts', 'src/auth/access-context.ts'],
  ['src/**/*.ts', 'src/index.ts'],
  ['Dockerfile*', 'Dockerfile.hosted'],
  ['Dockerfile*', 'Dockerfile'],
  ['tsconfig*.json', 'tsconfig.build.json'],
  ['.env.example', '.env.example'],
  ['src/?.ts', 'src/a.ts'],
  ['docs/api-surface/**', 'docs/api-surface/src/index.d.ts'],
] as const) {
  test(`Given the pattern ${pattern}, when the path ${path} is matched, then it matches, also with a dot file`, () => {
    assert.equal(anyGlobMatches([pattern], path), true);
  });
}

for (const [pattern, path] of [
  ['Dockerfile*', 'docker/Dockerfile'],
  ['src/*.ts', 'src/auth/a.ts'],
  ['src/?.ts', 'src/ab.ts'],
  ['src/**', 'srcx/a.ts'],
  ['docs/implementation/pr-review-rules.yaml', 'docs/implementation/pr-review-rules.yml'],
  ['a.b', 'axb'],
] as const) {
  test(`Given the pattern ${pattern}, when the path ${path} is matched, then it does not match`, () => {
    assert.equal(anyGlobMatches([pattern], path), false);
  });
}

test('Given a list of patterns, when a path matches one of them, then the list matches', () => {
  assert.equal(anyGlobMatches(['docs/**', 'src/**'], 'src/a.ts'), true);
  assert.equal(anyGlobMatches(['docs/**', 'src/**'], 'test/a.ts'), false);
  assert.equal(anyGlobMatches([], 'src/a.ts'), false);
});

test('Given a pattern with minimatch syntax that the check does not support, when it is checked, then it is refused', () => {
  for (const pattern of ['src/{a,b}.ts', 'src/[ab].ts', '!src/**', 'src/@(a|b).ts', 'src\\a.ts', '']) assert.equal(unsupportedGlob(pattern), true, pattern);
  for (const pattern of ['src/**', 'Dockerfile*', '.github/**', 'src/?.ts']) assert.equal(unsupportedGlob(pattern), false, pattern);
});
