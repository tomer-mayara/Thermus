import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { documentProcessMarkdown, processFixture, recordsIn, reportOfOutcomes, type ProcessJson } from './fixtures/ast-metrics-process.ts';

// The stage outcomes that the process writes with --json, which the review route check reads with --process.
// ast-metrics-process.test.ts specifies the report without the option.
const timeout = 20_000;

function processJsonIn(path: string): ProcessJson {
  return JSON.parse(readFileSync(path, 'utf8')) as ProcessJson;
}

test('Given --json FILE, when the complete process runs, then the file holds the merge base, HEAD, and the four stage outcomes of the printed report, which does not change', { timeout }, async (t) => {
  const { repository, run } = processFixture(t);
  const result = await run(['--json', 'ast-report/process.json']);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, documentProcessMarkdown(repository));
  const file = processJsonIn(join(repository.root, 'ast-report/process.json'));
  assert.deepEqual(Object.keys(file), ['version', 'base', 'head', 'outcomes']);
  assert.equal(file.version, 1);
  assert.equal(file.base, repository.git('merge-base', 'origin/main', 'HEAD').trim());
  assert.equal(file.head, repository.git('rev-parse', 'HEAD').trim());
  assert.deepEqual(file.outcomes.map(({ name, status }) => `${name}: ${status}`), ['Delta: passed', 'Review: passed', 'CRAP: passed', 'Architecture: passed']);
  assert.equal(reportOfOutcomes(file.outcomes), result.stdout);
});

test('Given an ambiguous review exit 1 and --json with a path relative to a subfolder, when the process runs, then the file holds the failed review and the unavailable dependent stages of the printed report', { timeout }, async (t) => {
  const { repository, run } = processFixture(t, { reviewExitCode: 1, reviewSkipJson: true });
  const result = await run(['--json', '../out/process.json'], join(repository.root, 'script'));

  assert.equal(result.code, 1);
  const file = processJsonIn(join(repository.root, 'out/process.json'));
  assert.deepEqual(file.outcomes.map(({ name, status }) => `${name}: ${status}`), ['Delta: passed', 'Review: failed', 'CRAP: unavailable', 'Architecture: unavailable']);
  assert.equal(reportOfOutcomes(file.outcomes), result.stdout);
  assert.equal(readFileSync(join(repository.root, 'ast-report/process.md'), 'utf8'), result.stdout);
  assert.equal(recordsIn(repository).length, 0);
});
