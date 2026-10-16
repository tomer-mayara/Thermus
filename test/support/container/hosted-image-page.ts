import childProcess from 'node:child_process';
import type { LookupAllOptions } from 'node:dns';
import dns from 'node:dns/promises';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';

const origin = 'http://localhost:8090/';
const article = '<!DOCTYPE html><html><head><title>Image story</title></head><body><main><h1>Image story</h1><p id="story">Waiting for JavaScript</p><aside class="ad-banner-container">Image advertisement that the rules must remove from this article.</aside><div hidden>Hidden image instruction</div></main><script src="/story.js"></script></body></html>';
const script = "document.getElementById('story').textContent = 'JavaScript produced this article with enough words to keep the complete paragraph.';";
const pages = createServer((request, response) => {
  process.stderr.write(`Image page request ${request.url}\n`);
  if (request.url === '/slow') return;
  response.setHeader('Content-Type', request.url === '/story.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/story.js' ? script : article);
});
pages.on('connection', () => process.stderr.write('Image page connection\n'));
pages.listen(8090, '127.0.0.1').unref();

// Only the controlled page passes the first DNS guard. Production CIDR rules still apply to every other URL.
const lookup = dns.lookup;
dns.lookup = ((hostname: string, options: LookupAllOptions) => hostname === 'localhost'
  ? Promise.resolve([{ address: '1.1.1.1', family: 4 }])
  : lookup(hostname, options)) as typeof dns.lookup;

// This wrapper runs the packaged executable unchanged. It permits only the controlled loopback page and records
// child settlement so cancellation and shutdown assertions can observe the real child lifetime.
const execute = childProcess.execFile;
childProcess.execFile = ((...args: Parameters<typeof childProcess.execFile>) => {
  if (args[0] !== process.env.LIGHTPANDA_BIN || args[1]?.[0] !== 'fetch') return Reflect.apply(execute, childProcess, args);
  const command = [...(args[1] ?? [])];
  const url = command.at(-1) ?? '';
  if (url === `${origin}story` || url === `${origin}slow`) command.splice(-1, 0, '--block-cidrs', '-127.0.0.1/32');
  const child = execute(args[0], command, args[2], args[3]);
  process.stderr.write(`Image renderer started ${url}\n`);
  child.once('close', (code, signal) => process.stderr.write(`Image renderer settled ${url} ${code} ${signal}\n`));
  return child;
}) as typeof childProcess.execFile;
syncBuiltinESMExports();
