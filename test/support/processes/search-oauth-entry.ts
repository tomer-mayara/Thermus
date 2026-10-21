import { pathToFileURL } from 'node:url';
import { searchScript } from './module-paths.ts';

const { runSearchCommand } = await import(pathToFileURL(searchScript).href);
const settings = JSON.parse(process.env.THERMUS_TEST_OAUTH ?? '{}') as {
  profile: { endpoint: string; issuer: string; clientId: string };
  interactive?: boolean;
  redirectUrl?: string;
};

process.exitCode = await runSearchCommand(process.argv.slice(2), {
  ...settings,
  interactive: settings.interactive ?? true,
  openBrowser: async (url: URL) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('The test browser could not complete authorization.');
  },
});
