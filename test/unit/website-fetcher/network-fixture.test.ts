import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { test } from 'node:test';
import { permitIPv4Fixture } from '../../support/network-fixture.ts';

const fixtureUrl = 'http://localhost:8123/page';
const fetchArgs = [
  'fetch', '--json', '--block-private-networks', '--block-cidrs', '127.0.0.0/8', '--http-proxy', '', fixtureUrl,
];

for (const configured of [undefined, '', '/opt/Lightpanda runtime/lightpanda']) {
  test(`fixture launcher permits the selected executable and keeps the launch options, also the environment, when LIGHTPANDA_BIN is ${String(configured)}`, (t) => {
    const environment = { ...process.env };
    if (configured === undefined) delete environment.LIGHTPANDA_BIN;
    else environment.LIGHTPANDA_BIN = configured;
    t.mock.property(process, 'env', environment);
    const execute = t.mock.method(childProcess, 'execFile', () => new childProcess.ChildProcess());
    permitIPv4Fixture(t);
    const executable = configured || 'lightpanda';
    const launchOptions = { encoding: 'utf8', env: { PATH: '/usr/bin', LIGHTPANDA_DISABLE_TELEMETRY: 'true' }, timeout: 60_000 } as const;

    childProcess.execFile(executable, fetchArgs, launchOptions, () => {});

    assert.equal(execute.mock.callCount(), 1);
    const [command, args, options] = execute.mock.calls[0].arguments;
    assert.equal(command, executable);
    assert.deepEqual(args, [...fetchArgs.slice(0, -1), '--block-cidrs', '-127.0.0.1/32', fixtureUrl]);
    assert.deepEqual(options, launchOptions);
    assert.throws(() => childProcess.execFile('other-renderer', fetchArgs, () => {}), assert.AssertionError);
    assert.throws(() => childProcess.execFile(executable, [...fetchArgs.slice(0, -1), 'https://example.com/'], () => {}), assert.AssertionError);
    assert.equal(execute.mock.callCount(), 1);
  });
}
