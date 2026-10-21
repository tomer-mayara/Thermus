import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { componentDefinitionsOf, componentOf, componentOwnersOf } = await import(new URL('../component-ownership.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/component-ownership.ts');

const definitions = { app: { roots: ['src/app/'], files: ['src/index.ts'] }, identity: { roots: ['src/accounts/identity/'] } };

test('Given nested roots and an exact entrypoint, when ownership is resolved, then grouping folders and other root files have no owner', () => {
  assert.equal(componentOf('src/accounts/identity/context.ts', definitions), 'identity');
  assert.equal(componentOf('src/app/private/input.ts', definitions), 'app');
  assert.equal(componentOf('src/index.ts', definitions), 'app');
  assert.equal(componentOf('src/other.ts', definitions), undefined);
  assert.equal(componentOf('src/accounts/file.ts', definitions), undefined);
  assert.equal(componentOf('src/accounts/identity-extra/file.ts', definitions), undefined);
  assert.throws(() => componentOwnersOf(['src/accounts/unknown.svg'], definitions), /no component owner/);
});

test('Given overlapping owner roots or exact files, when the inventory is checked, then ambiguity is refused instead of choosing the longest match', () => {
  assert.throws(() => componentOwnersOf(['src/accounts/identity/context.ts'], { ...definitions, accounts: { roots: ['src/accounts/'] } }), /ambiguous/);
  assert.throws(() => componentOwnersOf(['src/index.ts'], { ...definitions, other: { roots: [], files: ['src/index.ts'] } }), /ambiguous/);
});

test('Given legacy ownership without a definition, when the resolver runs, then first-level folders and composition remain compatible', () => {
  assert.equal(componentOf('src/auth/context.ts'), 'auth');
  assert.equal(componentOf('src/index.ts'), 'composition');
  assert.equal(componentOf('src/../context.ts'), undefined);
  assert.equal(componentDefinitionsOf(undefined, 'snapshot'), undefined);
});

for (const value of [{ 'bad/id': { roots: ['src/app/'] } }, { app: { roots: ['src/'] } }, { app: { roots: ['src/app'] } }, { app: { roots: [], files: ['src/../secret.ts'] } }, { app: { roots: [] } }]) {
  test(`Given invalid owner metadata ${JSON.stringify(value)}, when it is read, then the error identifies the definition`, () => {
    assert.throws(() => componentDefinitionsOf(value, 'policy'), /policy:/);
  });
}
