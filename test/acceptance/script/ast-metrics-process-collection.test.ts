import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { processFixture, recordsIn } from './fixtures/ast-metrics-process.ts';

// Both complete unit parts are selected in this small repository. Only its fixture
// tests run; this case cannot start the application's unit suite.
const fixtureFiles = {
  'package.json': JSON.stringify({ type: 'module', scripts: { build: 'node script/build.cjs' } }),
  'script/build.cjs': "require('node:fs').mkdirSync('ast-report', {recursive:true}); require('node:fs').appendFileSync('ast-report/collection.log', 'build\\n');\n",
  'dist/src/auth/session.js': 'export function openSession() { return 1; }\n',
  'dist/test/unit/process.test.js': "import {appendFileSync} from 'node:fs'; import {test} from 'node:test'; import {openSession} from '../../src/auth/session.js'; test('emitted fixture',()=>{openSession(); appendFileSync('ast-report/collection.log','node\\n');});\n",
  'test/unit/user-portal/process.test.ts': "import {appendFileSync} from 'node:fs'; import {test} from 'node:test'; test('portal fixture',()=>appendFileSync('ast-report/collection.log','portal\\n'));\n",
};

test('Given both fixture unit parts were selected, when collection is explicit, then the process builds once, runs each part once, and uses the verified report', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.commit('Add the selected fixture suites', fixtureFiles);
  repository.write({ 'README.md': '# Complete candidate\n' });

  const result = await run(['--collect-coverage']);

  assert.equal(result.code, 0, result.stderr + result.stdout);
  assert.equal(readFileSync(join(repository.root, 'ast-report/collection.log'), 'utf8'), 'build\nnode\nportal\n');
  const coverage = JSON.parse(readFileSync(join(repository.root, 'ast-report/coverage.json'), 'utf8'));
  assert.equal(coverage.provenance.status, 'verified');
  assert.equal(coverage.suite, 'unit');
  assert.match(result.stdout, /Collected verified compatible unit coverage/);
  assert.equal(recordsIn(repository).length, 1);
});

test('Given the fixture build fails during explicit collection, when the process runs, then it saves an unavailable assessment and writes no historical record', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({ 'package.json': JSON.stringify({ scripts: { build: 'node -e "process.exit(1)"' } }) });
  const result = await run(['--collect-coverage']);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /The build failed\. No coverage is written\./);
  assert.match(result.stdout, /## Architecture\n\nStatus: unavailable\./);
  assert.equal(recordsIn(repository).length, 0);
});
