import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { documentProcessMarkdown, processFixture } from './fixtures/ast-metrics-process.ts';

test('Given a document-only candidate without coverage, when the complete process runs, then it saves four ordered sections, records structure, and calls no CRAP session or suite', { timeout: 20_000 }, async (t) => {
  const { repository, doubles, run } = processFixture(t);
  const result = await run();

  assert.equal(result.code, 0, result.stderr);
  assert.equal(readFileSync(join(repository.root, 'ast-report/process.md'), 'utf8'), result.stdout);
  assert.equal(result.stdout, documentProcessMarkdown(repository));
  assert.deepEqual([...result.stdout.matchAll(/^## (Delta|Review|CRAP|Architecture)$/gm)].map((match) => match[1]), ['Delta', 'Review', 'CRAP', 'Architecture']);
  assert.match(result.stdout, /No production files to assess\./);
  assert.match(result.stdout, /```mermaid\nflowchart LR/);
  assert.match(result.stdout, /The map did not change\./);
  const records = readdirSync(join(repository.root, 'docs/metrics')).filter((name) => name.endsWith('.json'));
  assert.equal(records.length, 1);
  assert.equal(JSON.parse(readFileSync(join(repository.root, 'docs/metrics', records[0]), 'utf8')).functionsOver30, undefined);
  assert.deepEqual(doubles.cli.calls().filter(({ argv }) => argv[0] !== 'version').map(({ argv }) => argv[0]), ['review', 'analyze', 'mcp', 'analyze', 'mcp']);
  assert.equal(existsSync(join(repository.root, 'dist')), false);
});
