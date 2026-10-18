import { pathToFileURL } from 'node:url';
import { fetchUrlScript } from './module-paths.ts';

const profile = JSON.parse(process.env.THERMUS_FETCH_PROOF_PROFILE ?? '{}') as { endpoint: string; issuer: string; clientId: string };
const { runFetchUrlCommand } = await import(pathToFileURL(fetchUrlScript).href) as {
  runFetchUrlCommand(args: readonly string[], runtime: unknown): Promise<number>;
};
process.exitCode = await runFetchUrlCommand(process.argv.slice(2), {
  profile,
  interactive: true,
  openBrowser: async (url: URL) => {
    if (process.send === undefined) throw new Error('The private browser channel is missing.');
    process.send({ kind: 'authorization', url: url.href });
  },
});
