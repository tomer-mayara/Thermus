import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/mi-floor.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/mi-floor.ts')>;
type Input = Parameters<typeof import('../../../script/code-quality/assessment/mi-floor.ts').miFloorOf>[0];

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid shape ${JSON.stringify(input)}, when an MI floor is calculated, then the root object is rejected`, async () => {
    const { miFloorOf } = await load();
    assert.throws(() => miFloorOf(input as unknown as Input), { message: 'Invalid MI floor input at input: expected an object.' });
  });
}

for (const floor of [undefined, null, NaN, Infinity, -Infinity, '90', true, {}, []]) {
  test(`Given invalid floor ${String(floor)} with head absent, when calculated, then the mandatory floor is still validated`, async () => {
    const { miFloorOf } = await load();
    assert.throws(() => miFloorOf({ floor } as Input), { message: 'Invalid MI floor input at floor: expected a finite number.' });
  });
}

for (const head of [null, NaN, Infinity, -Infinity, '90', true, {}, []]) {
  test(`Given invalid supplied head ${String(head)}, when calculated against a generous floor, then invalid data cannot become a pass or unknown`, async () => {
    const { miFloorOf } = await load();
    assert.throws(() => miFloorOf({ head, floor: -Number.MAX_VALUE } as Input), { message: 'Invalid MI floor input at head: expected a finite number.' });
  });
}

test('Given a valid floor with absent or undefined head, when calculated, then the floor is retained and no head value is invented', async () => {
  const { miFloorOf } = await load();
  for (const floor of [-Number.MAX_VALUE, 0, Number.MAX_VALUE]) {
    const expected = { observation: { floor }, meetsFloor: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' } };
    assert.deepEqual(miFloorOf({ floor }), expected);
    assert.deepEqual(miFloorOf({ head: undefined, floor }), expected);
  }
});

for (const [head, floor, state] of [
  [90, 90, 'PASS'], [89.99999999999999, 90, 'MISS'],
  [-5, -5, 'PASS'], [-5.000001, -5, 'MISS'], [-4.999999, -5, 'PASS'],
  [0, 0, 'PASS'], [-0, 0, 'PASS'], [129, 128, 'PASS'],
  [Number.MIN_VALUE, 0, 'PASS'], [0, Number.MIN_VALUE, 'MISS'],
  [-Number.MIN_VALUE, 0, 'MISS'], [0, -Number.MIN_VALUE, 'PASS'],
  [Number.MAX_VALUE, -Number.MAX_VALUE, 'PASS'], [-Number.MAX_VALUE, Number.MAX_VALUE, 'MISS'],
  [Number.MAX_VALUE, Number.MAX_VALUE, 'PASS'], [-Number.MAX_VALUE, -Number.MAX_VALUE, 'PASS'],
] as const) {
  test(`Given raw head ${Object.is(head, -0) ? '-0' : head} and floor ${floor}, when compared, then inclusive ordering gives ${state}`, async () => {
    const { miFloorOf } = await load();
    assert.deepEqual(miFloorOf({ head, floor }), {
      observation: { head, floor },
      meetsFloor: { state, reason: state === 'PASS' ? 'Raw MI is at least the supplied floor.' : 'Raw MI is below the supplied floor.' },
    });
  });
}

test('Given frozen raw operands, when an MI floor is calculated, then the input stays unchanged and the result retains its precision', async () => {
  const { miFloorOf } = await load();
  const input = Object.freeze({ head: 84.96, floor: 84.96000000000001 });
  const result = miFloorOf(input);
  assert.deepEqual(input, { head: 84.96, floor: 84.96000000000001 });
  assert.deepEqual(result.observation, { head: 84.96, floor: 84.96000000000001 });
  assert.equal(result.meetsFloor.state, 'MISS');
});
