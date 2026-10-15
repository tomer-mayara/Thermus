// Runs in a server container of the container gate. container-site.ts copies it there, and NODE_OPTIONS loads it with
// --import before the server. It is the test-only seam of the renderer cases, as network-fixture.ts is in a local
// Node process. It serves a JavaScript page on port 8090 of the container and makes the lookup of localhost give a
// public address, as resolveAsPublic does, so a fetch of localhost passes the check of the fetcher. With
// CONTAINER_GATE_PAGE=permitted, it also lets the renderer reach 127.0.0.1 for the page, as permitIPv4Fixture does.
// With blocked, the renderer starts as in production. The seam keeps the renderer environment, so the image settings,
// also the telemetry setting, apply. Each renderer launch and each connection and request of the page give one line
// on stderr.
import childProcess, { type ChildProcess } from 'node:child_process';
import type { LookupAllOptions } from 'node:dns';
import dns from 'node:dns/promises';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';

const PAGE_PORT = 8090;
const PAGE_ORIGIN = `http://localhost:${PAGE_PORT}/`;
const PUBLIC_ADDRESS = '1.1.1.1';
const PERMITTED_ADDRESS = '-127.0.0.1/32';
const access = process.env.CONTAINER_GATE_PAGE;
if (access !== 'permitted' && access !== 'blocked') throw new Error('Set CONTAINER_GATE_PAGE to permitted or blocked');

const page = '<!DOCTYPE html><html><head><title>Runtime fixture</title></head><body><main><h1>Runtime story</h1>'
  + '<p id="status">Waiting for the script</p><div id="slot"></div></main><script src="/story.js"></script></body></html>';
const script = `document.getElementById('status').textContent = 'The script rendered this paragraph with enough words to keep it.';
document.getElementById('slot').innerHTML = '<p class="requested-host-target">Requested host target</p><p class="final-host-target">Final host target</p>'
  + '<p>Related <a href="related">article</a> and <a href="/root">root</a>.</p><div hidden>Hidden instruction from the script</div>';`;
const files: Readonly<Record<string, readonly [string, string]>> = { '/story': ['text/html', page], '/story.js': ['text/javascript', script] };

const pages = createServer((request, response) => {
  process.stderr.write(`Container page request ${request.url}\n`);
  const [type, body] = files[request.url ?? ''] ?? ['text/plain', 'Missing page'];
  response.statusCode = type === 'text/plain' ? 404 : 200;
  response.setHeader('Content-Type', type);
  response.end(body);
});
pages.on('connection', () => process.stderr.write('Container page connection\n'));
// The page must not keep the server process alive after a stop signal.
pages.listen(PAGE_PORT, '0.0.0.0').unref();

const lookup = dns.lookup;
dns.lookup = ((hostname: string, options: LookupAllOptions) => (hostname === 'localhost'
  ? Promise.resolve([{ address: PUBLIC_ADDRESS, family: 4 }])
  : lookup(hostname, options))) as typeof dns.lookup;

// The launch line tells a block of the fetcher, which starts no renderer, from a block of the renderer.
const execute = childProcess.execFile;
childProcess.execFile = ((...args: Parameters<typeof childProcess.execFile>) => {
  if (args[0] !== process.env.LIGHTPANDA_BIN) return Reflect.apply(execute, childProcess, args) as ChildProcess;
  const command = [...(args[1] ?? [])];
  const url = command.at(-1) ?? '';
  process.stderr.write(`Container renderer launch ${url}\n`);
  if (access === 'permitted' && url.startsWith(PAGE_ORIGIN)) command.splice(-1, 0, '--block-cidrs', PERMITTED_ADDRESS);
  return execute(args[0], command, args[2], args[3]);
}) as typeof childProcess.execFile;
syncBuiltinESMExports();
