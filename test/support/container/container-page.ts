// The test-only page seam of the renderer cases. It does in a server container what network-fixture.ts does in a local
// Node process. NODE_OPTIONS loads it with --import before the server, and CONTAINER_GATE_PAGE selects its mode.
// container-site.ts copies it into a server container of the container gate for the modes permitted and blocked.
// hosted-image-gate.ts mounts it into a server container of the hosted image for the mode hosted.
// The seam serves a JavaScript page on port 8090 of the container. It makes the lookup of localhost give a public
// address, as resolveAsPublic does, so a fetch of localhost passes the check of the fetcher. The production CIDR rules
// still apply to each other URL. The modes permitted and hosted also let the renderer reach 127.0.0.1 for the page, as
// permitIPv4Fixture does: permitted for each URL of the page, hosted only for the story and the slow page. With blocked,
// the renderer starts as in production. The seam runs the real renderer with its environment, so the image settings,
// also the telemetry setting, apply. Each renderer launch and each connection and request of the page give one line on
// stderr. In the mode hosted, the end of each renderer also gives a line, so a test sees the real lifetime of the
// renderer.
import childProcess, { type ChildProcess } from 'node:child_process';
import type { LookupAllOptions } from 'node:dns';
import dns from 'node:dns/promises';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';

const PAGE_PORT = 8090;
const PAGE_ORIGIN = `http://localhost:${PAGE_PORT}/`;
const PUBLIC_ADDRESS = '1.1.1.1';
const PERMITTED_ADDRESS = '-127.0.0.1/32';

const runtimeStory = '<!DOCTYPE html><html><head><title>Runtime fixture</title></head><body><main><h1>Runtime story</h1>'
  + '<p id="status">Waiting for the script</p><div id="slot"></div></main><script src="/story.js"></script></body></html>';
const runtimeScript = `document.getElementById('status').textContent = 'The script rendered this paragraph with enough words to keep it.';
document.getElementById('slot').innerHTML = '<p class="requested-host-target">Requested host target</p><p class="final-host-target">Final host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p><div hidden>Hidden instruction from the script</div>';`;
const imageStory = '<!DOCTYPE html><html><head><title>Image story</title></head><body><main><h1>Image story</h1>'
  + '<p id="story">Waiting for JavaScript</p><aside class="ad-banner-container">Image advertisement that the rules must remove from this article.</aside>'
  + '<div hidden>Hidden image instruction</div></main><script src="/story.js"></script></body></html>';
const imageScript = "document.getElementById('story').textContent = 'JavaScript produced this article with enough words to keep the complete paragraph.';";

type Answer = readonly [status: number, type: string, body: string];

interface Mode {
  // A path with null gets no answer, so a renderer that loads it runs until it is stopped.
  readonly files: Readonly<Record<string, Answer | null>>;
  readonly otherPaths: Answer;
  readonly host: string;
  readonly linePrefix: string;
  readonly launchWord: string;
  readonly permits: (url: string) => boolean;
  readonly logsSettlement: boolean;
  readonly wrapsOnlyFetch: boolean;
}

const selfHosted: Omit<Mode, 'permits'> = {
  files: { '/story': [200, 'text/html', runtimeStory], '/story.js': [200, 'text/javascript', runtimeScript] },
  otherPaths: [404, 'text/plain', 'Missing page'],
  host: '0.0.0.0',
  linePrefix: 'Container',
  launchWord: 'launch',
  logsSettlement: false,
  wrapsOnlyFetch: false,
};
const modes: Readonly<Record<string, Mode>> = {
  permitted: { ...selfHosted, permits: (url) => url.startsWith(PAGE_ORIGIN) },
  blocked: { ...selfHosted, permits: () => false },
  // The hosted startup checks the version of the renderer. That check gives no line.
  hosted: {
    files: { '/story.js': [200, 'text/javascript', imageScript], '/slow': null },
    otherPaths: [200, 'text/html', imageStory],
    host: '127.0.0.1',
    linePrefix: 'Image',
    launchWord: 'started',
    permits: (url) => url === `${PAGE_ORIGIN}story` || url === `${PAGE_ORIGIN}slow`,
    logsSettlement: true,
    wrapsOnlyFetch: true,
  },
};
const modeName = process.env.CONTAINER_GATE_PAGE ?? '';
if (!Object.hasOwn(modes, modeName)) throw new Error('Set CONTAINER_GATE_PAGE to permitted, blocked, or hosted');
const mode = modes[modeName];

const pages = createServer((request, response) => {
  process.stderr.write(`${mode.linePrefix} page request ${request.url}\n`);
  const path = request.url ?? '';
  const answer = Object.hasOwn(mode.files, path) ? mode.files[path] : mode.otherPaths;
  if (answer === null) return;
  const [status, type, body] = answer;
  response.statusCode = status;
  response.setHeader('Content-Type', type);
  response.end(body);
});
pages.on('connection', () => process.stderr.write(`${mode.linePrefix} page connection\n`));
// The page must not keep the server process alive after a stop signal.
pages.listen(PAGE_PORT, mode.host).unref();

const lookup = dns.lookup;
dns.lookup = ((hostname: string, options: LookupAllOptions) => (hostname === 'localhost'
  ? Promise.resolve([{ address: PUBLIC_ADDRESS, family: 4 }])
  : lookup(hostname, options))) as typeof dns.lookup;

function wraps([file, args]: Parameters<typeof childProcess.execFile>): boolean {
  return file === process.env.LIGHTPANDA_BIN && (!mode.wrapsOnlyFetch || args?.[0] === 'fetch');
}

// The launch line tells a block of the fetcher, which starts no renderer, from a block of the renderer.
const execute = childProcess.execFile;
childProcess.execFile = ((...args: Parameters<typeof childProcess.execFile>) => {
  if (!wraps(args)) return Reflect.apply(execute, childProcess, args) as ChildProcess;
  const command = [...(args[1] ?? [])];
  const url = command.at(-1) ?? '';
  if (mode.permits(url)) command.splice(-1, 0, '--block-cidrs', PERMITTED_ADDRESS);
  const child = execute(args[0], command, args[2], args[3]);
  process.stderr.write(`${mode.linePrefix} renderer ${mode.launchWord} ${url}\n`);
  if (mode.logsSettlement) child.once('close', (code, signal) => process.stderr.write(`${mode.linePrefix} renderer settled ${url} ${code} ${signal}\n`));
  return child;
}) as typeof childProcess.execFile;
syncBuiltinESMExports();
