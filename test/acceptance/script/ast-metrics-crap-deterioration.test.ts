import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-deterioration.ts', pathToFileURL(astMetricsCrapScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-deterioration.ts')>;

test('Given exact CRAP 10 to 15, when deterioration is calculated, then five points misses while a smaller increase only misses no deterioration', async () => {
  const { crapDeteriorationOf } = await load();
  assert.deepEqual(crapDeteriorationOf({ reference: { paths: 10, share: 1 }, head: { paths: 15, share: 1 } }), {
    observation: {
      reference: { kind: 'known-coverage', paths: 10, share: 1, displayValue: 10 },
      head: { kind: 'known-coverage', paths: 15, share: 1, displayValue: 15 },
    },
    belowFive: { state: 'MISS', reason: 'The operands prove CRAP deterioration >=5.' },
    noDeterioration: { state: 'MISS', reason: 'The operands prove CRAP deterioration >0.' },
  });
  const smaller = crapDeteriorationOf({ reference: { paths: 10, share: 1 }, head: { paths: 11, share: 1 } });
  assert.equal(smaller.belowFive.state, 'PASS');
  assert.equal(smaller.noDeterioration.state, 'MISS');
});

test('Given three paths on each side without coverage, when deterioration is calculated, then equal path counts do not prove either goal', async () => {
  const { crapDeteriorationOf } = await load();
  assert.deepEqual(crapDeteriorationOf({ reference: { paths: 3 }, head: { paths: 3 } }), {
    observation: {
      reference: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
      head: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
    },
    belowFive: { state: 'UNKNOWN', reason: 'The bounds do not settle whether CRAP deterioration is below 5.' },
    noDeterioration: { state: 'UNKNOWN', reason: 'The bounds do not settle whether CRAP deteriorates.' },
  });
});

test('Given exact reference 42 and head bounds 6 to 42, when deterioration is calculated, then both goals pass without choosing an exception', async () => {
  const { crapDeteriorationOf } = await load();
  assert.deepEqual(crapDeteriorationOf({ reference: { paths: 6, share: 0 }, head: { paths: 6 } }), {
    observation: {
      reference: { kind: 'known-coverage', paths: 6, share: 0, displayValue: 42 },
      head: { kind: 'missing-coverage', paths: 6, lower: 6, upper: 42 },
    },
    belowFive: { state: 'PASS', reason: 'The upper bound proves CRAP deterioration <5.' },
    noDeterioration: { state: 'PASS', reason: 'The upper bound proves no CRAP deterioration.' },
  });
});

test('Given mixed known and bounded CRAP, when endpoints prove or cannot settle deterioration, then each goal keeps its own result', async () => {
  const { crapDeteriorationOf } = await load();
  const miss = crapDeteriorationOf({ reference: { paths: 1 }, head: { paths: 7, share: 1 } });
  assert.equal(miss.belowFive.state, 'MISS');
  assert.equal(miss.noDeterioration.state, 'MISS');
  const mixed = crapDeteriorationOf({ reference: { paths: 3 }, head: { paths: 4, share: 1 } });
  assert.equal(mixed.belowFive.state, 'PASS');
  assert.equal(mixed.noDeterioration.state, 'UNKNOWN');
  const strict = crapDeteriorationOf({ reference: { paths: 1, share: 1 }, head: { paths: 2 } });
  assert.equal(strict.belowFive.state, 'UNKNOWN');
  assert.equal(strict.noDeterioration.state, 'MISS');
  const precise = crapDeteriorationOf({ reference: { paths: 7, share: 0.9999999 }, head: { paths: 3 } });
  assert.ok(precise.observation.reference?.kind === 'known-coverage');
  assert.equal(precise.observation.reference.displayValue, 7);
  assert.equal(precise.belowFive.state, 'PASS');
  assert.equal(precise.noDeterioration.state, 'UNKNOWN');
});

test('Given subnormal coverage changes hidden by display values, when deterioration is calculated, then exact operands decide zero and five boundaries', async () => {
  const { crapDeteriorationOf } = await load();
  const belowFive = crapDeteriorationOf({ reference: { paths: 25, share: 1 }, head: { paths: 5, share: 1e-320 } });
  assert.ok(belowFive.observation.head?.kind === 'known-coverage');
  assert.equal(belowFive.observation.head.displayValue, 30);
  assert.equal(belowFive.belowFive.state, 'PASS');
  const positive = crapDeteriorationOf({ reference: { paths: 5, share: 1e-320 }, head: { paths: 5, share: 0 } });
  assert.ok(positive.observation.reference?.kind === 'known-coverage');
  assert.ok(positive.observation.head?.kind === 'known-coverage');
  assert.equal(positive.observation.reference.displayValue, 30);
  assert.equal(positive.observation.head.displayValue, 30);
  assert.equal(positive.noDeterioration.state, 'MISS');
  const improvement = crapDeteriorationOf({ reference: { paths: 5, share: 0 }, head: { paths: 5, share: 1e-320 } });
  assert.equal(improvement.noDeterioration.state, 'PASS');
});
