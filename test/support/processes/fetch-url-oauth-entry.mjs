import { runFetchUrlCommand } from '../../../script/fetch-url.mjs';

const settings = JSON.parse(process.env.THERMUS_TEST_OAUTH);
if (settings.failSync) {
  const { default: fs } = await import('node:fs');
  const { syncBuiltinESMExports } = await import('node:module');
  fs.fsyncSync = () => { throw new Error('Test-only durable-write refusal.'); };
  syncBuiltinESMExports();
}
const runtime = {
  profile: settings.profile,
  interactive: settings.interactive ?? true,
  authTimeoutMs: settings.authTimeoutMs,
  redirectUrl: settings.redirectUrl,
  openBrowser: async (url) => {
    if (settings.browserAction === 'cancel') { process.kill(process.pid, 'SIGTERM'); return; }
    if (settings.browserAction === 'wait') return;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('The test browser could not complete authorization.');
  },
};
process.exitCode = await runFetchUrlCommand(process.argv.slice(2), runtime);
