import assert from 'node:assert/strict';
import childProcess, {
  ChildProcess,
  type ExecFileException,
  type ExecFileOptionsWithStringEncoding,
} from 'node:child_process';
import dns from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { LIGHTPANDA_BLOCKED_CIDRS } from '../../../src/website-fetcher/network-policy.ts';
import { WebsiteFetcherLightpanda } from '../../../src/website-fetcher/website-fetcher-lightpanda.ts';

type Completion = (error: ExecFileException | null, stdout: string, stderr: string) => void;
type Launch = [executable: string, args: readonly string[], options: ExecFileOptionsWithStringEncoding, finish: Completion];

function productionArguments(url: string): string[] {
  return [
    'fetch', '--json', '--dump', 'html', '--fail-on-http-error',
    '--wait-until', 'networkidle', '--wait-ms', '60000',
    '--block-private-networks', '--block-cidrs', LIGHTPANDA_BLOCKED_CIDRS,
    '--http-proxy', '',
    url,
  ];
}

test('Given one fetcher with a configured executable, when two calls run concurrently, then each child gets the same executable, arguments, and options with its own URL, and each call gets its own result', async (t) => {
  const executable = '/opt/Lightpanda runtime/lightpanda';
  const pages = [
    { url: 'https://first.example/page?call=1', finalUrl: 'https://first.example/final', html: '<html>First page</html>' },
    { url: 'https://second.example/page?call=2', finalUrl: 'https://second.example/final', html: '<html>Second page</html>' },
  ];
  const launches: Launch[] = [];
  // If an assertion fails, the calls stay open. Fake timers and kill doubles prevent a real kill at the readiness
  // deadline: kill on an unspawned ChildProcess sends the signal to the whole process group.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]);
  t.mock.method(childProcess, 'execFile', ((...launch: Launch) => {
    launches.push(launch);
    const child = new ChildProcess();
    t.mock.method(child, 'kill', () => true);
    return child;
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const fetcher = new WebsiteFetcherLightpanda(executable);

  const results = pages.map(({ url }) => fetcher.fetchURL(url));
  await new Promise<void>((resolve) => { setImmediate(resolve); });

  assert.equal(launches.length, 2);
  const launchFor = (url: string) => {
    const launch = launches.find(([, args]) => args.at(-1) === url);
    assert.ok(launch, `No renderer started for ${url}`);
    return launch;
  };
  for (const { url } of pages) {
    const [command, args, options] = launchFor(url);
    assert.equal(command, executable);
    assert.deepEqual(args, productionArguments(url));
    assert.deepEqual(options, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60_000 });
  }
  for (const { url, finalUrl, html } of pages.toReversed()) {
    const [, , , finish] = launchFor(url);
    finish(null, JSON.stringify({ url: finalUrl, http_status: 200, content: html, error: null }), '');
  }

  assert.deepEqual(await Promise.all(results), pages.map(({ url, finalUrl, html }) => ({ requestedUrl: url, finalUrl, html })));
});
