import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/mi-decline.ts', pathToFileURL(astMetricsSnapshotScript)).href;
type Operands = Parameters<typeof import('../../../script/code-quality/assessment/mi-decline.ts').miDeclineOf>[0];
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/mi-decline.ts')>;

for (const [reference, head, belowFive, noDeterioration] of [
  [0, 0, 'PASS', 'PASS'], [-12.5, -12.5, 'PASS', 'PASS'], [96, 91, 'MISS', 'MISS'],
  [96, 91.000001, 'PASS', 'MISS'], [96, 90.999999, 'MISS', 'MISS'], [84, 85, 'PASS', 'PASS'],
  [Number.MIN_VALUE, 0, 'PASS', 'MISS'], [0, Number.MIN_VALUE, 'PASS', 'PASS'],
  [5, Number.MIN_VALUE, 'PASS', 'MISS'], [5, -Number.MIN_VALUE, 'MISS', 'MISS'],
  [Number.MAX_VALUE, -Number.MAX_VALUE, 'MISS', 'MISS'], [-Number.MAX_VALUE, Number.MAX_VALUE, 'PASS', 'PASS'],
  [8.2, 3.2, 'MISS', 'MISS'], [5.000000000000001, 1e-15, 'MISS', 'MISS'],
  [-Number.MIN_VALUE, -2 * Number.MIN_VALUE, 'PASS', 'MISS'],
] as const) {
  test(`Given raw MI ${reference} to ${head}, when assessed, then exact decimal comparisons retain both independent decisions`, async () => {
    const { miDeclineOf } = await load();
    assert.deepEqual(miDeclineOf({ reference, head }), {
      observation: { reference, head },
      belowFive: { state: belowFive, reason: belowFive === 'PASS' ? 'Raw MI decline is below 5.' : 'Raw MI decline is at least 5.' },
      noDeterioration: { state: noDeterioration, reason: noDeterioration === 'PASS' ? 'Raw MI does not deteriorate.' : 'Raw MI deteriorates.' },
    });
  });
}

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid shape ${JSON.stringify(input)}, when assessed, then the shape is rejected`, async () => {
    const { miDeclineOf } = await load();
    assert.throws(() => miDeclineOf(input as unknown as Operands), { message: 'Invalid MI decline input at input: expected an object.' });
  });
}

for (const field of ['reference', 'head'] as const) {
  for (const value of [null, '85', true, [], {}, NaN, Infinity, -Infinity]) {
    test(`Given invalid ${field} ${String(value)} and no other operand, when assessed, then invalid data is rejected before an unknown result`, async () => {
      const { miDeclineOf } = await load();
      assert.throws(() => miDeclineOf({ [field]: value } as Operands), { message: `Invalid MI decline input at ${field}: expected a finite number.` });
    });
  }
}

test('Given explicit undefined operands, when assessed, then observation fields stay absent and both results are unknown', async () => {
  const { miDeclineOf } = await load();
  const result = miDeclineOf({ reference: undefined, head: undefined });
  assert.deepEqual(result, {
    observation: {},
    belowFive: { state: 'UNKNOWN', reason: 'Reference and head raw MI are missing.' },
    noDeterioration: { state: 'UNKNOWN', reason: 'Reference and head raw MI are missing.' },
  });
  assert.deepEqual(miDeclineOf({ reference: 0, head: undefined }).observation, { reference: 0 });
  assert.deepEqual(miDeclineOf({ reference: undefined, head: 0 }).observation, { head: 0 });
});

test('Given a valid reference and invalid head, when assessed, then the invalid head is rejected', async () => {
  const { miDeclineOf } = await load();
  assert.throws(() => miDeclineOf({ reference: 90, head: null } as unknown as Operands), { message: 'Invalid MI decline input at head: expected a finite number.' });
});

test('Given frozen supplied operands, when assessed, then operands are retained without changing the input or exposing a numeric difference', async () => {
  const { miDeclineOf } = await load();
  const input = Object.freeze({ reference: Number.MAX_VALUE, head: -Number.MAX_VALUE });
  const result = miDeclineOf(input);
  assert.deepEqual(input, { reference: Number.MAX_VALUE, head: -Number.MAX_VALUE });
  assert.deepEqual(Object.keys(result).sort(), ['belowFive', 'noDeterioration', 'observation']);
  assert.deepEqual(Object.keys(result.observation).sort(), ['head', 'reference']);
});
