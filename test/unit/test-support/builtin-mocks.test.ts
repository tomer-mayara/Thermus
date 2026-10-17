import assert from 'node:assert/strict';
import childProcess, { execFile } from 'node:child_process';
import dns, { lookup } from 'node:dns/promises';
import { test } from 'node:test';
import { syncBuiltinMocks } from '../../support/doubles/website-fetcher/builtin-mocks.ts';

const originalLookup = dns.lookup;
const originalExecFile = childProcess.execFile;

test('Given a mock of lookup of node:dns/promises, when syncBuiltinMocks runs in a test, then the named export lookup is the mock in that test, and at the end of that test the named export and the module property are the original function again', async (t) => {
  await t.test('mocks lookup and syncs the built-in mocks', (inner) => {
    const mocked = inner.mock.method(dns, 'lookup', async () => []);

    syncBuiltinMocks(inner);

    assert.equal(lookup, mocked);
    assert.notEqual(lookup, originalLookup);
  });

  assert.equal(lookup, originalLookup);
  assert.equal(dns.lookup, originalLookup);
});

test('Given mocks of two built-in modules and one syncBuiltinMocks call, when the test ends, then the named exports and the module properties of both modules are the original functions again', async (t) => {
  await t.test('mocks lookup and execFile and syncs the built-in mocks', (inner) => {
    inner.mock.method(dns, 'lookup', async () => []);
    const mocked = inner.mock.method(childProcess, 'execFile', () => assert.fail('The test started a process.'));

    syncBuiltinMocks(inner);

    assert.equal(execFile, mocked);
  });

  assert.equal(lookup, originalLookup);
  assert.equal(dns.lookup, originalLookup);
  assert.equal(execFile, originalExecFile);
  assert.equal(childProcess.execFile, originalExecFile);
});
