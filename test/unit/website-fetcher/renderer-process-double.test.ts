import assert from 'node:assert/strict';
import childProcess, { ChildProcess, type ExecFileException } from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { RendererChildDouble } from '../../support/renderer-process-double.ts';

type Completion = (error: ExecFileException | null, stdout: string, stderr: string) => void;

for (const requester of ['the readiness deadline', 'a cancellation'] as const) {
  test(`Given a running fetch with the renderer child double, when ${requester} requests a kill, then the double records SIGKILL and sends no signal to a process`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    // A double that calls one of these Node APIs fails the check, and the replacements send no signal.
    const signalSenders = [t.mock.method(ChildProcess.prototype, 'kill', () => true), t.mock.method(process, 'kill', () => true)];
    const child = new RendererChildDouble();
    const launched = Promise.withResolvers<Completion>();
    t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
    t.mock.method(childProcess, 'execFile', ((...args: Parameters<typeof childProcess.execFile>): ChildProcess => {
      launched.resolve(args[3] as Completion);
      return child;
    }) as typeof childProcess.execFile);
    syncBuiltinESMExports();
    t.after(() => {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    });
    const controller = new AbortController();
    const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/', controller.signal);
    const finish = await launched.promise;

    if (requester === 'the readiness deadline') t.mock.timers.tick(5_000);
    else controller.abort();

    assert.deepEqual(child.signals, ['SIGKILL']);
    assert.deepEqual(signalSenders.map((sender) => sender.mock.callCount()), [0, 0]);
    finish(Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGKILL' as const, code: null }), '', '');
    await assert.rejects(result);
  });
}
