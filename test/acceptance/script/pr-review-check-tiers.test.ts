import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';
import { historicalRulesYaml, mainFiles, rulesPath, rulesYaml } from './fixtures/pr-review-rules.ts';

const classification = {
  container: false, external: false, contract: false, deployment: false, crossCutting: false,
  component: false, internalInterface: false, sensitiveBehavior: false, dependencyRisk: false, policy: false, uncertain: false,
};

function impactFor(repository: GitRepository, changes: Partial<typeof classification> = {}) {
  repository.write({ 'ast-report/impact.json': JSON.stringify({
    version: 1, base: repository.git('rev-parse', 'main').trim(), head: repository.git('rev-parse', 'HEAD').trim(),
    classification: { ...classification, ...changes },
    architecture: { modelUpdated: false, summary: 'The existing views still match the code.', views: ['Context', 'Runtime'], evidence: ['docs/guide.md'] },
  }) });
}

async function check(t: Parameters<typeof runScript>[0], repository: GitRepository, impact = true) {
  const result = await runScript(t, prReviewCheckScript, { args: ['--base', 'main', '--json', ...(impact ? ['--impact', 'ast-report/impact.json'] : [])], cwd: repository.root });
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('Given an external contract change and a failed invariant, when the candidate is classified, then T2 Need architect remains and merge is blocked', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), '.gitignore': 'ast-report/\n', '.habit-hooks/snooze.json': '[]\n' });
  repository.commit('Change the external contract with an unresolved check', { 'src/index.ts': 'export const value = 2;\n', '.habit-hooks/snooze.json': '[{}]\n' });
  impactFor(repository, { contract: true });
  const result = await check(t, repository);
  assert.equal(result.tier, 'T2');
  assert.equal(result.tierName, 'T2 Need architect');
  assert.equal(result.eligibility, 'blocked');
  assert.ok(result.blockers.some((reason: { key: string }) => reason.key === 'size.habit_hooks_snooze_non_empty'));
  assert.ok(result.reasons.some((reason: { key: string }) => reason.key === 'impact.contract'));
});

test('Given a process change with unchanged architecture, when the candidate is classified, then it needs T1 Team review', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), '.gitignore': 'ast-report/\n' });
  repository.commit('Clarify the process', { 'AGENTS.md': '# Agents\n\nA changed review rule.\n' });
  impactFor(repository, { policy: true });
  const result = await check(t, repository);
  assert.equal(result.tier, 'T1');
  assert.equal(result.tierName, 'T1 Team review');
});

test('Given an ordinary prose change with complete architecture evidence, when the candidate is classified, then T0 Auto merge needs no production metrics', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(), '.gitignore': 'ast-report/\n' });
  repository.commit('Correct prose', { 'docs/guide.md': '# Guide\n\nClearer text.\n' });
  impactFor(repository);
  const result = await check(t, repository);
  assert.equal(result.tier, 'T0');
  assert.equal(result.tierName, 'T0 Auto merge');
  assert.equal(result.eligibility, 'eligible');
  assert.deepEqual(result.blockers, []);
});

test('Given no architecture evidence, when the checker runs, then the candidate cannot qualify for automatic merge', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.commit('Correct prose', { 'docs/guide.md': '# Guide\n\nClearer text.\n' });
  const result = await check(t, repository, false);
  assert.equal(result.tier, 'T1');
  assert.equal(result.eligibility, 'blocked');
  assert.ok(result.blockers.some((reason: { key: string }) => reason.key === 'impact.missing'));
});


test('Given an architect requirement in the trusted historical base, when HEAD changes the policy to T1, then that candidate still needs T2 Need architect', async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { ...mainFiles(historicalRulesYaml()), '.gitignore': 'ast-report/\n' });
  repository.commit('Adopt the tier policy', { [rulesPath]: rulesYaml(), 'AGENTS.md': '# Agents\n\nA revised process.\n' });
  impactFor(repository, { policy: true });
  const result = await check(t, repository);
  assert.equal(result.tier, 'T2');
  assert.ok(result.reasons.some((reason: { tier: string; key: string }) => reason.tier === 'T2' && reason.key === 'protected_paths.policy'));
  assert.equal(result.eligibility, 'blocked');
  assert.ok(result.blockers.some((reason: { key: string }) => reason.key === 'evidence.process'));
});

for (const initial of ['', 'not: [valid']) {
  test(`Given ${initial === '' ? 'missing' : 'invalid'} trusted base rules, when HEAD supplies its own valid policy, then local eligibility stays blocked`, async (t) => {
    const initialFiles = mainFiles();
    if (initial === '') delete initialFiles[rulesPath];
    else initialFiles[rulesPath] = initial;
    const repository = GitRepository.onFeatureBranch(t, { ...initialFiles, '.gitignore': 'ast-report/\n' });
    repository.commit('Supply a new policy', { [rulesPath]: rulesYaml() });
    impactFor(repository, { policy: true });
    const result = await check(t, repository);
    assert.equal(result.eligibility, 'blocked');
    assert.ok(result.blockers.some((reason: { key: string }) => reason.key === 'policy.untrusted_base'));
  });
}
