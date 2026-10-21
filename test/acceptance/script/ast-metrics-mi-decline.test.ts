import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/mi-decline.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/mi-decline.ts')>;

test('Given comparable raw MI values, when decline goals are calculated, then exactly five misses and smaller deterioration stays separate from no deterioration', async () => {
  const { miDeclineOf } = await load();
  assert.deepEqual(miDeclineOf({ reference: 96, head: 91 }), {
    observation: { reference: 96, head: 91 },
    belowFive: { state: 'MISS', reason: 'Raw MI decline is at least 5.' },
    noDeterioration: { state: 'MISS', reason: 'Raw MI deteriorates.' },
  });
  assert.equal(miDeclineOf({ reference: 96, head: 91.000001 }).belowFive.state, 'PASS');
  assert.equal(miDeclineOf({ reference: 96, head: 90.999999 }).belowFive.state, 'MISS');
  assert.equal(8.2 - 3.2, 4.999999999999999);
  assert.deepEqual(miDeclineOf({ reference: 8.2, head: 3.2 }), {
    observation: { reference: 8.2, head: 3.2 },
    belowFive: { state: 'MISS', reason: 'Raw MI decline is at least 5.' },
    noDeterioration: { state: 'MISS', reason: 'Raw MI deteriorates.' },
  });
  const small = miDeclineOf({ reference: 96, head: 95 });
  assert.equal(small.belowFive.state, 'PASS');
  assert.equal(small.noDeterioration.state, 'MISS');
});

test('Given head raw MI 85 with reference 90, when floor and decline arithmetic are calculated independently, then meeting the floor does not clear the five-point miss', async () => {
  const { miDeclineOf } = await load();
  const { fileMi85Of } = await import(new URL('assessment/file-mi85.ts', pathToFileURL(astMetricsSnapshotScript)).href);
  const expected = { commit: 'a'.repeat(40), tool: '0.43.1' };
  const text = JSON.stringify({ version: 1, ...expected, files: [{ path: 'src/a.ts', maintainabilityRaw: 85 }] });
  assert.equal(fileMi85Of(text, expected, ['src/a.ts'])[0].state, 'MEETS');
  assert.equal(miDeclineOf({ reference: 90, head: 85 }).belowFive.state, 'MISS');
  assert.deepEqual(miDeclineOf({ reference: 84, head: 85 }), {
    observation: { reference: 84, head: 85 },
    belowFive: { state: 'PASS', reason: 'Raw MI decline is below 5.' },
    noDeterioration: { state: 'PASS', reason: 'Raw MI does not deteriorate.' },
  });
});

test('Given missing raw MI operands, when decline is calculated, then each goal remains unknown and missing operands stay absent', async () => {
  const { miDeclineOf } = await load();
  for (const [input, reason] of [[{}, 'Reference and head raw MI are missing.'], [{ reference: 90 }, 'Head raw MI is missing.'], [{ head: 85 }, 'Reference raw MI is missing.']] as const) {
    assert.deepEqual(miDeclineOf(input), { observation: input, belowFive: { state: 'UNKNOWN', reason }, noDeterioration: { state: 'UNKNOWN', reason } });
  }
});

test('Given a positive subnormal head under reference five, when decline is calculated, then exact decimal operands prove a pass despite rounded subtraction reaching five', async () => {
  const { miDeclineOf } = await load();
  assert.equal(5 - Number.MIN_VALUE, 5);
  assert.deepEqual(miDeclineOf({ reference: 5, head: Number.MIN_VALUE }), {
    observation: { reference: 5, head: Number.MIN_VALUE },
    belowFive: { state: 'PASS', reason: 'Raw MI decline is below 5.' },
    noDeterioration: { state: 'MISS', reason: 'Raw MI deteriorates.' },
  });
});
