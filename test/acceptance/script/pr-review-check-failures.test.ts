import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { documentationDiscrepancies } from '../../support/drivers/script-documentation.ts';
import { prReviewCheckScript, repositoryRoot } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { scriptHelp } from '../../support/processes/script-help.ts';
import { GitRepository } from './fixtures/git-repository.ts';
import { checkOn } from './fixtures/pr-review-check.ts';
import { guideChange, mainFiles, rulesPath, rulesYaml } from './fixtures/pr-review-rules.ts';

// The failures of the review route check, and its help. pr-review-check.test.ts specifies the routes.
const timeout = 30_000;
const atHead = `pr-review-check: The rules file ${rulesPath} at HEAD`;

for (const [name, rules, diagnostic] of [
  ['without the package list', rulesYaml(({ dependency_graph: graph }) => { Reflect.deleteProperty(graph, 'packages'); }),
    `${atHead} has no valid key dependency_graph.packages: give a list of text.\n`],
  ['that gives a trigger another route', rulesYaml(({ dependency_graph: graph }) => { graph.triggers.known_cycle_grows = 'READ'; }),
    `${atHead} has no valid key dependency_graph.triggers.known_cycle_grows: give FIX, the route that the check uses.\n`],
  ['without the MI limit of a new file', rulesYaml(({ ratchet }) => { Reflect.deleteProperty(ratchet.maintainability_index, 'new_file_below'); }),
    `${atHead} has no valid key ratchet.maintainability_index.new_file_below: give a whole number, 0 or more.\n`],
  ['with a CRAP goal of 10 for a new function', rulesYaml(({ ratchet }) => { ratchet.crap.new_function_above = 10; }),
    `${atHead} has no valid key ratchet.crap.new_function_above: give 15; the check supports the goals 15 and 30 only.\n`],
  ['with a number as the location of the review findings', rulesYaml(({ ratchet }) => { Object.assign(ratchet, { review_findings: 42 }); }),
    `${atHead} has no valid key ratchet.review_findings: give a non-empty text, or leave it out.\n`],
] as const) {
  test(`Given a rules file ${name}, when the check runs, then it exits 1 and names the key`, { timeout }, async (t) => {
    const repository = GitRepository.onFeatureBranch(t, mainFiles(rules));
    repository.commit('Change the guide', guideChange);

    const result = await checkOn(t, repository);

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, diagnostic);
    assert.equal(result.code, 1);
  });
}

test('Given a rules file that is not valid YAML, when the check runs, then it exits 1 and says so', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles('protected_paths: [policy\n'));
  repository.commit('Change the guide', guideChange);

  const result = await checkOn(t, repository);

  assert.equal(result.stdout, '');
  assert.match(result.stderr, new RegExp(`^${atHead.replaceAll('.', '\\.')} is not valid YAML: \\S.*\\n$`));
  assert.equal(result.code, 1);
});

test('Given a branch that deletes the rules file, when the check runs, then it exits 1 because the rules file does not exist at HEAD', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());
  repository.git('rm', '--quiet', rulesPath);
  repository.commit('Delete the rules file');

  const result = await checkOn(t, repository);

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `pr-review-check: The rules file ${rulesPath} does not exist at HEAD. Commit it, or name another file with --rules.\n`);
  assert.equal(result.code, 1);
});

test('Given a base ref that does not exist, when the check runs, then it exits 1 and names the ref', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, mainFiles());

  const result = await runScript(t, prReviewCheckScript, { args: ['--base', 'missing'], cwd: repository.root });

  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'pr-review-check: The base ref "missing" is not a commit in this repository. Fetch it, or name another ref with --base.\n');
  assert.equal(result.code, 1);
});

for (const [name, args, diagnostic] of [
  ['an unknown option', ['--unknown'], 'Invalid arguments. Use --help for the supported options.'],
  ['an absolute rules path', ['--rules', '/etc/rules.yaml'], 'The --rules value must name a file of the repository, relative to its root.'],
  ['a rules path outside the repository', ['--rules', 'docs/../../rules.yaml'], 'The --rules value must name a file of the repository, relative to its root.'],
  ['a repository without an owner', ['--repo', 'Thermus'], 'The --repo value must have the form OWNER/NAME.'],
  ['a head snapshot without a base snapshot', ['--head-snapshot', 'ast-report/snapshot.json'], 'Give both --base-snapshot and --head-snapshot, or neither.'],
  ['a process file without a review file', ['--process', 'ast-report/process.json'], 'Give both --process and --review, or neither.'],
] as const) {
  test(`Given ${name}, when the check runs, then it exits 1 with a diagnostic before it reads git`, { timeout }, async (t) => {
    const result = await runScript(t, prReviewCheckScript, { args, env: { PATH: '' } });

    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `pr-review-check: ${diagnostic}\n`);
    assert.equal(result.code, 1);
  });
}

test('Given the README of the check, when the help is read without child processes, then the README gives the same synopsis, options, and defaults', { timeout }, async (t) => {
  const command = 'script/pr-review/check.ts';
  const help = await scriptHelp(t, command);
  const readme = readFileSync(new URL('script/pr-review/README.md', repositoryRoot), 'utf8');

  assert.deepEqual(documentationDiscrepancies({ command, help, readme }), []);
});
