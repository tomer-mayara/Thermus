import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { hostedFetchSettings, workOSSettings } from '../../support/fixtures/hosted-placeholder.ts';
import { heldHostedCleanup, heldHostedIdentity, lingeringHostedHandle } from '../../support/processes/module-paths.ts';
import { ServerProcess } from '../../support/processes/server-process.ts';
import { withPreload } from '../../support/processes/server-preloads.ts';

const settings = {
  DEPLOYMENT: 'hosted', PUBLIC_BASE_URL: 'https://thermus.example', LISTEN_HOST: '127.0.0.1', LISTEN_PORT: '0',
  ...hostedFetchSettings, ...workOSSettings,
};

for (const [failure, preload] of [['a residual library handle', lingeringHostedHandle], ['cleanup that never settles', heldHostedCleanup]] as const) {
  test(`Given a hosted CLI with ${failure}, when SIGTERM starts shutdown, then the process exits with a failure at the fixed deadline below the Render stop window`, { timeout: 15_000 }, async (t) => {
    const server = await ServerProcess.start(t, withPreload(settings, preload));
    const started = performance.now();
    const result = await server.stop();
    const elapsed = performance.now() - started;

    assert.deepEqual(result, { code: 1, signal: null }, server.output);
    assert.match(server.output, /Hosted shutdown exceeded 10000 ms/);
    assert.ok(elapsed >= 9_500 && elapsed < 13_000, `Shutdown took ${elapsed.toFixed(0)} ms`);
  });
}


for (const [path, heldStage] of [['/mcp', 'token verification'], ['/account', 'browser authentication'], ['/session', 'browser authentication']] as const) {
  // Process setup has its own allowance. The shutdown itself must still complete within one second.
  test(`Given a hosted CLI waiting for ${heldStage} on ${path}, when SIGTERM starts shutdown, then the process exits cleanly without waiting for identity work or its shutdown deadline`, { timeout: 15_000 }, async (t) => {
    let phase = 'server startup';
    const server = ServerProcess.launch(t, withPreload(settings, heldHostedIdentity));
    const reportTimeout = (): void => { t.diagnostic(`Hosted shutdown test stopped during ${phase}.\n${server.output}`); };
    t.signal.addEventListener('abort', reportTimeout, { once: true });
    t.after(() => t.signal.removeEventListener('abort', reportTimeout));
    await server.started();
    phase = 'waiting for held identity work';
    const response = server.request(path, path === '/mcp'
      ? { method: 'POST', headers: { Authorization: 'Bearer held-token', 'Content-Type': 'application/json' }, body: '{}' }
      : {}).catch(() => undefined);
    t.after(async () => { await response; });
    while (!server.output.includes(`Held hosted ${heldStage}`)) await delay(10, undefined, { signal: t.signal });

    phase = 'shutdown';
    const started = performance.now();
    assert.deepEqual(await server.stop(), { code: 0, signal: null }, server.output);
    assert.ok(performance.now() - started < 1_000, server.output);
    assert.doesNotMatch(server.output, /Hosted shutdown exceeded/);
    phase = 'response cleanup';
  });
}
