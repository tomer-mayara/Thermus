import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { test } from 'node:test';
import { permitIPv4Fixture } from '../support/network-fixture.ts';

const fixtureUrl = 'http://localhost:8123/page';
const fetchArgs = [
  'fetch', '--json', '--block-private-networks', '--block-cidrs', '127.0.0.0/8', '--http-proxy', '', fixtureUrl,
];

for (const configured of [undefined, '', '/opt/Lightpanda runtime/lightpanda']) {
  test(`fixture launcher permits the selected executable when LIGHTPANDA_BIN is ${String(configured)}`, (t) => {
    const environment = { ...process.env };
    if (configured === undefined) delete environment.LIGHTPANDA_BIN;
    else environment.LIGHTPANDA_BIN = configured;
    t.mock.property(process, 'env', environment);
    const execute = t.mock.method(childProcess, 'execFile', () => new childProcess.ChildProcess());
    permitIPv4Fixture(t);
    const executable = configured || 'lightpanda';

    childProcess.execFile(executable, fetchArgs, { encoding: 'utf8', timeout: 60_000 }, () => {});

    assert.equal(execute.mock.callCount(), 1);
    const [command, args, options] = execute.mock.calls[0].arguments;
    assert.equal(command, executable);
    assert.deepEqual(args, [...fetchArgs.slice(0, -1), '--block-cidrs', '-127.0.0.1/32', fixtureUrl]);
    assert.equal(options?.shell, undefined);
    assert.equal(options?.timeout, 60_000);
    assert.equal(options?.encoding, 'utf8');
    assert.deepEqual(options?.env, { ...environment, LIGHTPANDA_DISABLE_TELEMETRY: 'true' });
    assert.throws(() => childProcess.execFile('other-renderer', fetchArgs, () => {}), assert.AssertionError);
    assert.throws(() => childProcess.execFile(executable, [...fetchArgs.slice(0, -1), 'https://example.com/'], () => {}), assert.AssertionError);
    assert.equal(execute.mock.callCount(), 1);
  });
}
