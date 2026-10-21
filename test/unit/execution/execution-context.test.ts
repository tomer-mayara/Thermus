import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertOperationId } from '../../../src/pipelines/execution/execution-context.ts';

for (const version of ['1', '2', '3', '4', '5', '6', '7', '8']) {
  test(`Given a version ${version} UUID, when the operation ID is checked, then its canonical text is accepted`, () => {
    assert.doesNotThrow(() => assertOperationId(`d35803fb-2c25-${version}273-8967-99eed265721b`));
  });
}

for (const variant of ['8', '9', 'a', 'b']) {
  test(`Given uppercase UUID text with variant ${variant}, when checked, then case does not change validity`, () => {
    assert.doesNotThrow(() => assertOperationId(`D35803FB-2C25-4273-${variant}967-99EED265721B`.toUpperCase()));
  });
}

for (const invalid of [undefined, null, 42, '', 'private-operation-id', 'x'.repeat(10_000),
  '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'd35803fb-2c25-0273-8967-99eed265721b', 'd35803fb-2c25-9273-8967-99eed265721b',
  'd35803fb-2c25-4273-7967-99eed265721b', 'd35803fb-2c25-4273-c967-99eed265721b',
  '{d35803fb-2c25-4273-8967-99eed265721b}', 'd35803fb2c254273896799eed265721b',
  'd35803fb-2c25-4273-8967-99eed265721b\n']) {
  test(`Given invalid operation ID ${String(invalid).slice(0, 50)}, when checked, then only a fixed error is returned`, () => {
    assert.throws(() => assertOperationId(invalid), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Invalid execution context');
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}
