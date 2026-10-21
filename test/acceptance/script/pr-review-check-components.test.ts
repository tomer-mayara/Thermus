import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stringify } from 'yaml';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn, routeOf } from './fixtures/pr-review-check.ts';
import { mainFiles, rulesDocument, rulesPath } from './fixtures/pr-review-rules.ts';

function nestedRules() {
  const rules = rulesDocument();
  return { ...rules, dependency_graph: { ...rules.dependency_graph, packages: undefined, components: {
    composition: { roots: [], files: ['src/index.ts'] },
    alpha: { roots: ['src/domain/alpha/'] }, beta: { roots: ['src/adapters/beta/'] },
  } }, public_surface: { ...rules.public_surface, between_packages: {
    alpha: ['src/domain/alpha/alpha.ts'], beta: ['src/adapters/beta/beta.ts'],
  } } };
}

test('Given committed nested component roots and an exact entrypoint, when the candidate is checked, then grouping folders are not packages and unstaged files are not read', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.write({ 'src/domain/alpha/alpha.ts': 'export const alpha = 1;\n', 'src/adapters/beta/beta.ts': 'export const beta = 2;\n' });
  repository.git('rm', '-r', 'src/alpha', 'src/beta');
  repository.commit('Group the components', {
    [rulesPath]: stringify(nestedRules()), 'src/index.ts': "import { alpha } from './domain/alpha/alpha.ts';\n\nexport const value = alpha;\n",
  });
  repository.write({ 'src/not-committed.ts': 'export {};\n' });
  const result = await checkOn(t, repository, '--allow-dirty');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(routeOf(result.stdout), 'CLARIFICATION_NEEDED');
  assert.doesNotMatch(result.stdout, /folder_not_listed|package_removed|edge_not_listed|not-committed/);
});

for (const path of ['src/unowned.ts', 'src/unknown/logo.svg']) {
  test(`Given a declared component layout and the committed unowned file ${path}, when checked, then the complete inventory fails`, async (t) => {
    const rules = nestedRules();
    const repository = GitRepository.onFeatureBranch(t, {
      [rulesPath]: stringify(rules), 'src/index.ts': 'export {};\n',
      'src/domain/alpha/alpha.ts': 'export {};\n', 'src/adapters/beta/beta.ts': 'export {};\n',
    });
    repository.commit('Add an unowned file', { [path]: 'unowned\n' });
    const result = await checkOn(t, repository);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /no component owner/);
    assert.ok(result.stderr.includes(path));
  });
}
