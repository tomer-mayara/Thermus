import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from './module-paths.ts';

type OAuthTestSettings = {
  profile: { endpoint: string; issuer: string; clientId: string };
  failSync?: boolean; interactive?: boolean; authTimeoutMs?: number; redirectUrl?: string;
  browserAction?: 'cancel' | 'wait';
};
const { runFetchUrlCommand } = await import(pathToFileURL(fetchUrlScript).href);

const settings = JSON.parse(process.env.THERMUS_TEST_OAUTH ?? '{}') as OAuthTestSettings;
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
  openBrowser: async (url: URL) => {
    if (settings.browserAction === 'cancel') { process.kill(process.pid, 'SIGTERM'); return; }
    if (settings.browserAction === 'wait') return;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('The test browser could not complete authorization.');
  },
};
process.exitCode = await runFetchUrlCommand(process.argv.slice(2), runtime);
