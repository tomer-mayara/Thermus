import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-absolute.ts', pathToFileURL(astMetricsCrapScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-absolute.ts')>;

test('Given known coverage, when absolute CRAP goals are calculated, then 15 passes the inclusive goal and 30 fails the strict goal', async () => {
  const { crapAbsoluteOf } = await load();
  const fifteen = crapAbsoluteOf({ paths: 15, share: 1 });
  assert.deepEqual(fifteen.observation, { kind: 'known-coverage', paths: 15, share: 1, displayValue: 15 });
  assert.equal(fifteen.atMost15.state, 'PASS');
  assert.equal(fifteen.below30.state, 'PASS');
  assert.equal(crapAbsoluteOf({ paths: 15, share: 0.999 }).atMost15.state, 'MISS');
  const thirty = crapAbsoluteOf({ paths: 5, share: 0 });
  assert.ok(thirty.observation.kind === 'known-coverage');
  assert.equal(thirty.observation.displayValue, 30);
  assert.equal(thirty.atMost15.state, 'MISS');
  assert.equal(thirty.below30.state, 'MISS');
  assert.equal(crapAbsoluteOf({ paths: 5, share: 0.000001 }).below30.state, 'PASS');
});

test('Given no coverage share, when paths prove an absolute result, then bounds or proven zero retain that proof without invented coverage', async () => {
  const { crapAbsoluteOf } = await load();
  assert.deepEqual(crapAbsoluteOf({ paths: 3 }), {
    observation: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
    atMost15: { state: 'PASS', reason: 'The upper bound proves CRAP <=15.' },
    below30: { state: 'PASS', reason: 'The upper bound proves CRAP <30.' },
  });
  assert.deepEqual(crapAbsoluteOf({ paths: 0 }), {
    observation: { kind: 'proven-zero', paths: 0, value: 0 },
    atMost15: { state: 'PASS', reason: 'Zero paths prove CRAP 0.' },
    below30: { state: 'PASS', reason: 'Zero paths prove CRAP 0.' },
  });
});

test('Given missing coverage ranges that cross or exceed goals, when assessed, then uncertainty and proven misses remain separate', async () => {
  const { crapAbsoluteOf } = await load();
  assert.equal(crapAbsoluteOf({ paths: 4 }).atMost15.state, 'UNKNOWN');
  assert.equal(crapAbsoluteOf({ paths: 5 }).below30.state, 'UNKNOWN');
  assert.equal(crapAbsoluteOf({ paths: 16 }).atMost15.state, 'MISS');
  assert.equal(crapAbsoluteOf({ paths: 30 }).below30.state, 'MISS');
  assert.deepEqual(crapAbsoluteOf({ paths: 5, share: 0 }).observation, { kind: 'known-coverage', paths: 5, share: 0, displayValue: 30 });
  assert.deepEqual(crapAbsoluteOf({ paths: 5 }).observation, { kind: 'missing-coverage', paths: 5, lower: 5, upper: 30 });
});

test('Given tiny positive coverage whose displayed CRAP rounds to 30, when the strict goal is assessed, then exact operands still prove a pass', async () => {
  const { crapAbsoluteOf } = await load();
  assert.deepEqual(crapAbsoluteOf({ paths: 5, share: 1e-320 }), {
    observation: { kind: 'known-coverage', paths: 5, share: 1e-320, displayValue: 30 },
    atMost15: { state: 'MISS', reason: 'The coverage operands prove CRAP >15.' },
    below30: { state: 'PASS', reason: 'The coverage operands prove CRAP <30.' },
  });
});

test('Given almost complete coverage whose displayed CRAP rounds to 15, when the inclusive goal is assessed, then exact operands still prove a miss', async () => {
  const { crapAbsoluteOf } = await load();
  const result = crapAbsoluteOf({ paths: 15, share: 0.9999999 });
  assert.ok(result.observation.kind === 'known-coverage');
  assert.equal(result.observation.displayValue, 15);
  assert.deepEqual(result, {
    observation: { kind: 'known-coverage', paths: 15, share: 0.9999999, displayValue: 15 },
    atMost15: { state: 'MISS', reason: 'The coverage operands prove CRAP >15.' },
    below30: { state: 'PASS', reason: 'The coverage operands prove CRAP <30.' },
  });
});
