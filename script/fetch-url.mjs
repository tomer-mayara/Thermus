#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { Client, StreamableHTTPClientTransport, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';

const help = `Usage: node script/fetch-url.mjs --url URL --reason TEXT [options]

Call Thermus getURLAsMarkdown and print the exact Markdown to stdout.

Options:
  --url URL          Page to fetch (HTTP or HTTPS; required)
  --reason TEXT      Reason for the fetch (required)
  --endpoint URL     MCP endpoint (default: https://app.thermus.ai/mcp)
  --timeout-ms MS    Total deadline, including stdin (100..300000; default: 60000)
  --api-key-stdin    Read the Bearer credential from stdin until EOF
  --help, -h         Show this help

Otherwise read the credential from THERMUS_API_KEY. Do not put it in arguments.
The hosted backend currently requires a WorkOS Connect OAuth access token.
Customer API keys require separate backend support; the API-key UI is a preview.
This command does not sign in or refresh tokens. Endpoint redirects are refused.
Use HTTPS endpoints, or loopback HTTP for local debugging.
`;

class DebugError extends Error {}

function optionsOf(args) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      url: { type: 'string' }, reason: { type: 'string' }, endpoint: { type: 'string', default: 'https://app.thermus.ai/mcp' },
      'timeout-ms': { type: 'string', default: '60000' }, 'api-key-stdin': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    } }));
  } catch {
    throw new DebugError('Invalid arguments. Use --help for supported options.');
  }
  if (values.help) return { help: true };
  httpUrl(values.url, 'page URL');
  if (values.reason === undefined || values.reason.trim() === '') throw new DebugError('Supply a nonempty --reason.');
  const endpoint = endpointOf(values.endpoint);
  const timeoutMs = Number(values['timeout-ms']);
  if (!/^\d+$/.test(values['timeout-ms']) || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300_000) {
    throw new DebugError('The --timeout-ms value must be an integer from 100 to 300000.');
  }
  return { url: values.url, reason: values.reason, endpoint, timeoutMs, stdin: values['api-key-stdin'] === true };
}

function endpointOf(value) {
  const endpoint = httpUrl(value, 'endpoint');
  if (endpoint.hash) throw new DebugError('The endpoint must not contain a fragment.');
  const loopback = endpoint.hostname === 'localhost' || endpoint.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !loopback) throw new DebugError('The endpoint must use HTTPS or loopback HTTP.');
  return endpoint;
}

function httpUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new DebugError(`Supply a valid ${label}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new DebugError(`The ${label} must use HTTP or HTTPS without embedded credentials.`);
  }
  return url;
}

async function credentialOf(fromStdin) {
  let credential = process.env.THERMUS_API_KEY ?? '';
  if (fromStdin) {
    credential = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      credential += chunk;
      if (credential.length > 65_536) throw new DebugError('The credential is too long.');
    }
  }
  credential = credential.trim();
  if (!credential || credential.length > 65_536 || !/^[A-Za-z0-9._~+/-]+=*$/.test(credential)) {
    throw new DebugError('Supply a Bearer credential through THERMUS_API_KEY or --api-key-stdin.');
  }
  return credential;
}

async function fetchMarkdown(options, signal, client) {
  const credential = await credentialOf(options.stdin);
  signal.throwIfAborted();
  const transport = new StreamableHTTPClientTransport(options.endpoint, {
    authProvider: { token: async () => credential },
    requestInit: { redirect: 'error' },
    fetch: (input, init) => {
      signal.throwIfAborted();
      return fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) });
    },
  });
  await client.connect(transport, { signal, timeout: options.timeoutMs });
  const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: options.url, reason: options.reason } }, { signal, timeout: options.timeoutMs });
  if (result.isError) throw new DebugError('getURLAsMarkdown failed. Check the page URL and server logs.');
  if (result.content.length !== 1 || result.content[0].type !== 'text') {
    throw new DebugError('Unexpected tool result: expected one Markdown text item.');
  }
  return result.content[0].text;
}

async function main() {
  const options = optionsOf(process.argv.slice(2));
  if (options.help) { process.stdout.write(help); return; }
  const controller = new AbortController();
  const client = new Client({ name: 'thermus-fetch-debug', version: '0.0.0' }, {
    versionNegotiation: { mode: 'auto', probe: { timeoutMs: options.timeoutMs, maxRetries: 0 } },
  });
  const deadline = setTimeout(() => controller.abort(new DebugError('The command timed out. Increase --timeout-ms if needed.')), options.timeoutMs);
  const aborted = new Promise((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
  });
  try {
    const markdown = await Promise.race([fetchMarkdown(options, controller.signal, client), aborted]);
    process.stdout.write(markdown);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(deadline);
    if (options.stdin) process.stdin.destroy();
    await client.close();
  }
}

try {
  await main();
} catch (error) {
  // Remote messages can contain credentials, so print only local diagnostics and numeric HTTP status.
  let message = 'MCP connection or protocol failed. Check the endpoint, credential, and server logs.';
  if (error instanceof DebugError) message = error.message;
  else if (error instanceof UnauthorizedError || (error instanceof SdkHttpError && [401, 403].includes(error.status))) {
    message = 'Authentication or access refused. Supply a valid Connect OAuth access token with Thermus access.';
  } else if (error instanceof SdkHttpError) message = `MCP HTTP request failed (status ${error.status}). Check the endpoint and server logs.`;
  process.stderr.write(`fetch-url: ${message}\n`);
  process.exitCode = 1;
}
