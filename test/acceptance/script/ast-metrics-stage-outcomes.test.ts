import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, type TestContext } from 'node:test';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import * as commands from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';
import { GitRepository } from './fixtures/git-repository.ts';

function stageProbe(t: TestContext, stage: 'delta' | 'review') {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
  const probe = join(repository.root, 'probe.ts');
  const module = new URL(`${stage}/run.ts`, pathToFileURL(commands.astMetricsDeltaScript)).href;
  const name = stage === 'delta' ? 'runDelta' : 'runReview';
  repository.write({ 'probe.ts': `import { ${name} } from ${JSON.stringify(module)};\ntry { console.log(JSON.stringify(${name}(process.cwd(), {base:'main',allowToolVersion:false,compare:false}))); } catch(error) {console.log(JSON.stringify({error:error.message})); process.exitCode=2;}\n` });
  return { repository, probe };
}

test('Given a low production score, when the internal delta runs, then it returns a completed failed goal', async (t) => {
  const { repository, probe } = stageProbe(t, 'delta');
  const fake = astMetricsCliFakeOnPath(t, { metrics: 'maintainability{path="{root}/src/a.ts"} 70\n' });
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, false);
  assert.match(report.text, /src\/a.ts/);
});

test('Given completed high review findings, when the internal review runs, then it returns failed goals and the Markdown', async (t) => {
  const { repository, probe } = stageProbe(t, 'review');
  const fake = astMetricsCliFakeOnPath(t, { review: '# Findings\n', exitCode: 1 });
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { text: '# Findings\n', passed: false });
});

test('Given an operational review failure, when the internal review runs, then it throws instead of returning failed goals', async (t) => {
  const { repository, probe } = stageProbe(t, 'review');
  const fake = astMetricsCliFakeOnPath(t, { review: '# Partial\n', reviewJson: '{', exitCode: 1 });
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).error, /review.*JSON/);
});

test('Given stale review JSON and a tool that writes no JSON, when review runs, then it rejects the incomplete result', async (t) => {
  const { repository, probe } = stageProbe(t, 'review');
  repository.write({ 'ast-report/review.json': '{"gate":"passed"}', 'ast-report/review.md': '# Old report\n' });
  const fake = astMetricsCliFakeOnPath(t, { review: '# Current report\n', reviewSkipJson: true });
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).error, /review wrote no .*review.json/);
});

test('Given a complete clean JSON report and operational exit status 2, when review runs, then it throws', async (t) => {
  const { repository, probe } = stageProbe(t, 'review');
  const fake = astMetricsCliFakeOnPath(t, { review: '# Report\n', reviewExitCode: 2 });
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).error, /inconsistent exit status 2/);
});

test('Given measured CRAP goals that fail, when the internal CRAP operation runs, then it returns a completed failed goal', async (t) => {
  const { repository, fake, coverage } = crapFixture(t, [{ name: 'run', paths: 20, share: 0.5 }]);
  const probe = join(repository.root, 'probe.ts');
  const module = new URL('crap/run.ts', pathToFileURL(commands.astMetricsCrapScript)).href;
  repository.write({ 'probe.ts': `import { runCrap } from ${JSON.stringify(module)};\nconst result = await runCrap({kind:'report',base:'main',paths:[],limit:30,target:15,allowToolVersion:false}); console.log(JSON.stringify(result));\n` });
  coverage();
  const result = await runScript(t, probe, { cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, false);
  assert.match(report.text, /70.0/);
});
