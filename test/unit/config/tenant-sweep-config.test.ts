import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadFreeTenantIdleDays, loadTenantSweepHour } from '../../../src/runtime/config/tenant-sweep-config.ts';

const rule = 'TENANT_SWEEP_HOUR_UTC must be a whole number from 0 to 23.';
const idleRule = 'FREE_TENANT_IDLE_DAYS must be a whole number from 1 to 365.';

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

test('Given no FREE_TENANT_IDLE_DAYS or an empty value, when the idle period is loaded, then it is 14 days (decision D-6)', () => {
  assert.equal(loadFreeTenantIdleDays({}), 14);
  assert.equal(loadFreeTenantIdleDays({ FREE_TENANT_IDLE_DAYS: '' }), 14);
});

test('Given a whole number from 1 to 365, when the idle period is loaded, then it is that number of days', () => {
  for (const days of [1, 7, 14, 30, 365]) assert.equal(loadFreeTenantIdleDays({ FREE_TENANT_IDLE_DAYS: String(days) }), days);
});

for (const value of ['0', '366', '-1', '014', '14.5', 'fourteen', ' 14', '14 ', '1e1', '0x1']) {
  test(`Given FREE_TENANT_IDLE_DAYS ${JSON.stringify(value)}, when the idle period is loaded, then it stops with the rule and without the value`, () => {
    assert.throws(() => loadFreeTenantIdleDays({ FREE_TENANT_IDLE_DAYS: value }), (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, idleRule);
      return true;
    });
  });
}
