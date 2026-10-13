import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BetterAuthRuntime } from '../../../src/auth-better-auth/better-auth-runtime.ts';
import { openBetterAuthAdministration } from '../../../src/auth-better-auth/local-user-administration.ts';
import { LocalProviderDouble } from './fixtures/local-provider-double.ts';

const settings = { dataDirectory: '/var/lib/magumagu', publicBaseUrl: 'http://localhost:8080/', mcpResourceUrl: 'http://localhost:8080/mcp' };

test('Given an open runtime, when administration opens and closes repeatedly, then it exposes only the role and close, and retains the runtime close promise and outcome', async () => {
  for (const closeFailure of [undefined, new Error('close failed')]) {
    const provider = new LocalProviderDouble();
    let closing: Promise<void> | undefined;
    let closes = 0;
    const runtime: BetterAuthRuntime = {
      installationId: 'installation-id', tenantId: 'local:installation-id',
      auth: provider.auth, resourceServerClient: provider.resourceServerClient,
      close: () => closing ??= (async () => { closes += 1; if (closeFailure) throw closeFailure; })(),
    };
    const opened = await openBetterAuthAdministration(settings, async (received) => {
      assert.equal(received, settings);
      return runtime;
    });
    assert.deepEqual(Object.keys(opened).sort(), ['administration', 'close']);
    assert.deepEqual(await opened.administration.listUsers(), []);
    const first = opened.close();
    assert.equal(opened.close(), first);
    if (closeFailure) await assert.rejects(first, (error) => error === closeFailure);
    else await first;
    assert.equal(opened.close(), first);
    assert.equal(closes, 1);
  }
});

test('Given a runtime that cannot hand off its provider, when administration opens, then it closes the runtime before rejecting and preserves a cleanup failure too', async () => {
  for (const closeFailure of [undefined, new Error('close failed')]) {
    const failure = new Error('provider handoff failed');
    let closes = 0;
    const runtime = {
      get auth() { throw failure; },
      close: async () => { closes += 1; if (closeFailure) throw closeFailure; },
    } as unknown as BetterAuthRuntime;
    await assert.rejects(openBetterAuthAdministration(settings, async () => runtime), (error) => {
      if (closeFailure) {
        assert.ok(error instanceof SuppressedError);
        assert.equal(error.suppressed, failure);
        assert.equal(error.error, closeFailure);
      } else assert.equal(error, failure);
      return true;
    });
    assert.equal(closes, 1);
  }
});

test('Given a runtime opening failure with a cleanup failure, when administration opens, then both original failures reach the caller', async () => {
  const failure = new SuppressedError(new Error('lock cleanup failed'), new Error('provider opening failed'));
  await assert.rejects(openBetterAuthAdministration(settings, async () => { throw failure; }), (error) => error === failure);
});
