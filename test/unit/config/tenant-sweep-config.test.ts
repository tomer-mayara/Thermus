import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadTenantSweepHour } from '../../../src/runtime/config/tenant-sweep-config.ts';

const rule = 'TENANT_SWEEP_HOUR_UTC must be a whole number from 0 to 23.';

test('Given no TENANT_SWEEP_HOUR_UTC or an empty value, when the hour is loaded, then it is 4', () => {
  assert.equal(loadTenantSweepHour({}), 4);
  assert.equal(loadTenantSweepHour({ TENANT_SWEEP_HOUR_UTC: '' }), 4);
});

test('Given a whole number from 0 to 23, when the hour is loaded, then it is that number', () => {
  for (let hour = 0; hour <= 23; hour += 1) assert.equal(loadTenantSweepHour({ TENANT_SWEEP_HOUR_UTC: String(hour) }), hour);
});

for (const value of ['24', '-1', '04', '4.5', 'four', ' 4', '4 ', '0x4', '1e1']) {
  test(`Given TENANT_SWEEP_HOUR_UTC ${JSON.stringify(value)}, when the hour is loaded, then it stops with the rule and without the value`, () => {
    assert.throws(() => loadTenantSweepHour({ TENANT_SWEEP_HOUR_UTC: value }), (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, rule);
      return true;
    });
  });
}
