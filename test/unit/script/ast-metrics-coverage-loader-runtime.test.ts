import assert from 'node:assert/strict';
import module from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';

const script = pathToFileURL(astMetricsCoverageScript);
const { observeLoaderShutdown } = await import(new URL('coverage/loader-runtime.ts', script).href) as typeof import('../../../script/code-quality/coverage/loader-runtime.ts');
const { captureIdOf, completionProtocol } = await import(new URL('coverage/protocol.ts', script).href) as typeof import('../../../script/code-quality/coverage/protocol.ts');

function isolateRuntime(t: TestContext) {
  const folder = dataDirectory(t);
  const emit = process.emit;
  const owner = process as NodeJS.Process & { _exiting?: boolean };
  const exiting = Object.getOwnPropertyDescriptor(owner, '_exiting');
  const value = owner._exiting;
  t.after(() => {
    t.mock.restoreAll();
    process.emit = emit;
    if (exiting !== undefined) Object.defineProperty(owner, '_exiting', exiting);
    owner._exiting = value;
    module.syncBuiltinESMExports();
  });
  return { folder, emit, owner, observe: () => observeLoaderShutdown({ folder, captureId: captureIdOf(folder), completionProtocol }) };
}

function identifyLoader(specifier: unknown, options: unknown): void {
  if (!(specifier instanceof URL)) return;
  const shared = new Int32Array((options as { data: { shared: SharedArrayBuffer } }).data.shared);
  Atomics.store(shared, 1, 1);
  Atomics.store(shared, 0, 1);
}

test('Given public module registration, when coverage observes its loader, then arguments, receiver, results, and thrown errors remain intact', (t) => {
  const runtime = isolateRuntime(t);
  const receiver = {};
  const args = ['application-loader', { data: { keep: 'original' } }];
  const result = {};
  const failure = new Error('Registration failed');
  const calls: { receiver: unknown; args: unknown[] }[] = [];
  t.mock.method(module, 'register', function (this: unknown, ...values: unknown[]) {
    if (values[0] instanceof URL) {
      identifyLoader(values[0], values[1]);
      return;
    }
    calls.push({ receiver: this, args: values });
    if (values[0] === 'invalid-loader') throw failure;
    return result;
  });
  runtime.observe();

  assert.equal(Reflect.apply(module.register, receiver, args), result);
  assert.equal(calls[0].receiver, receiver);
  assert.deepEqual(calls[0].args, args);
  assert.equal(calls[0].args[1], args[1]);
  const options = { data: { keep: 'third argument' } };
  module.register('application-loader', 'file:///preserved-parent', options);
  assert.deepEqual(calls[1].args, ['application-loader', 'file:///preserved-parent', options]);
  assert.equal(calls[1].args[2], options);
  assert.throws(() => module.register('invalid-loader'), (error) => error === failure);
});

test('Given a nested exit emission, when outer exit listeners continue, then loader shutdown waits for all outer listeners and a timeout remains rejected', (t) => {
  const { folder, emit, owner, observe } = isolateRuntime(t);
  t.mock.method(module, 'register', identifyLoader);
  let nested = false;
  t.mock.method(process, 'emit', function (this: NodeJS.Process, event: string | symbol, ...args: unknown[]) {
    if (event !== 'exit') return Reflect.apply(emit, this, [event, ...args]);
    if (!nested) {
      nested = true;
      process.emit('exit', 0);
      assert.equal(readdirSync(folder).some((name) => name.startsWith('loader-request-')), false);
    }
    return true;
  });
  observe();
  // The registration stub identifies a loader but never acknowledges shutdown.
  module.register('application-loader');
  owner._exiting = true;

  assert.equal(process.emit('exit', 0), true);

  const receipt = readdirSync(folder).find((name) => name.startsWith('loader-receipt-'));
  assert.ok(receipt);
  assert.equal(JSON.parse(readFileSync(join(folder, receipt), 'utf8')).state, 'timeout');
});

test('Given manual exit events or unavailable exit state, when the emitter is called, then it preserves receiver, results, and exceptions without requesting loader shutdown', (t) => {
  const { folder, emit, owner, observe } = isolateRuntime(t);
  t.mock.method(module, 'register', identifyLoader);
  const failure = new Error('Exit listener failed');
  let receiver: unknown;
  t.mock.method(process, 'emit', function (this: NodeJS.Process, event: string | symbol, ...args: unknown[]) {
    if (event === 'message') return this;
    if (event !== 'exit') return Reflect.apply(emit, this, [event, ...args]);
    receiver = this;
    if (args[0] === 13) throw failure;
    return false;
  });
  observe();
  module.register('application-loader');
  owner._exiting = false;

  assert.equal(process.emit('exit', 0), false);
  delete owner._exiting;
  assert.equal(process.emit('exit', 0), false);
  owner._exiting = true;
  const borrowedReceiver = {};
  assert.equal(Reflect.apply(process.emit, borrowedReceiver, ['exit', 0]), false);
  assert.equal(receiver, borrowedReceiver);
  assert.equal(Reflect.apply(process.emit, borrowedReceiver, ['message', {}]), borrowedReceiver);
  assert.throws(() => process.emit('exit', 13), (error) => error === failure);
  assert.deepEqual(readdirSync(folder), []);
});
