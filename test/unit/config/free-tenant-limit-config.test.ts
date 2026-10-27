import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadFreeTenantLimit } from '../../../src/runtime/config/free-tenant-limit-config.ts';

const rule = 'FREE_TENANT_LIMIT must be a whole number from 0 to 1000.';

test('Given no FREE_TENANT_LIMIT or an empty value, when the limit is loaded, then it is 25', () => {
  assert.equal(loadFreeTenantLimit({}), 25);
  assert.equal(loadFreeTenantLimit({ FREE_TENANT_LIMIT: undefined }), 25);
  assert.equal(loadFreeTenantLimit({ FREE_TENANT_LIMIT: '' }), 25);
});

test('Given a whole number from 0 to 1000, when the limit is loaded, then it is that number, and 0 closes free signup through the cap', () => {
  for (let limit = 0; limit <= 1000; limit += 1) {
    assert.equal(loadFreeTenantLimit({ FREE_TENANT_LIMIT: String(limit) }), limit);
  }
});

for (const value of ['1001', '10000', '-1', '2.5', 'abc', ' 25', '25 ', '0x10', '1e3']) {
  test(`Given FREE_TENANT_LIMIT ${JSON.stringify(value)}, when the limit is loaded, then it stops with the rule and without the value`, () => {
    assert.throws(() => loadFreeTenantLimit({ FREE_TENANT_LIMIT: value }), (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, rule);
      return true;
    });
  });
}
