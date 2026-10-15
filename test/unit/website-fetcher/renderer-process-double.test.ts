import assert from 'node:assert/strict';
import { ChildProcess } from 'node:child_process';
import { test } from 'node:test';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';
import { mockRenderer } from '../../support/doubles/website-fetcher/renderer-process-double.ts';

for (const requester of ['the readiness deadline', 'a cancellation'] as const) {
  test(`Given a running fetch with the renderer child double, when ${requester} requests a kill, then the double records SIGKILL and sends no signal to a process`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    // A double that calls one of these Node APIs fails the check, and the replacements send no signal.
    const signalSenders = [t.mock.method(ChildProcess.prototype, 'kill', () => true), t.mock.method(process, 'kill', () => true)];
    const renderer = mockRenderer(t);
    const controller = new AbortController();
    const result = new WebsiteFetcherLightpanda().fetchURL('https://example.com/', controller.signal);
    await renderer.launched;

    if (requester === 'the readiness deadline') t.mock.timers.tick(5_000);
    else controller.abort();

    assert.deepEqual(renderer.child.signals, ['SIGKILL']);
    assert.deepEqual(signalSenders.map((sender) => sender.mock.callCount()), [0, 0]);
    renderer.finish(Object.assign(new Error('Command failed'), { killed: true, signal: 'SIGKILL' as const, code: null }), '', '');
    await assert.rejects(result);
  });
}
