import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeploymentConfigError } from '../../../src/runtime/config/deployment-config.ts';
import { loadOperationCapacity } from '../../../src/runtime/config/operation-capacity-config.ts';

const rule = 'OPERATION_CAPACITY must be a whole number from 1 to 100.';

test('Given no OPERATION_CAPACITY or an empty value, when the capacity is loaded, then it is 10', () => {
  assert.equal(loadOperationCapacity({}), 10);
  assert.equal(loadOperationCapacity({ OPERATION_CAPACITY: undefined }), 10);
  assert.equal(loadOperationCapacity({ OPERATION_CAPACITY: '' }), 10);
});

test('Given a whole number from 1 to 100, when the capacity is loaded, then it is that number', () => {
  for (let capacity = 1; capacity <= 100; capacity += 1) {
    assert.equal(loadOperationCapacity({ OPERATION_CAPACITY: String(capacity) }), capacity);
  }
});

for (const value of ['0', '101', '-1', '1.5', 'abc', ' 5', '0x10', '1e1']) {
  test(`Given OPERATION_CAPACITY ${JSON.stringify(value)}, when the capacity is loaded, then it stops with the rule and without the value`, () => {
    assert.throws(() => loadOperationCapacity({ OPERATION_CAPACITY: value }), (error: unknown) => {
      assert.ok(error instanceof DeploymentConfigError);
      assert.equal(error.message, rule);
      return true;
    });
  });
}
