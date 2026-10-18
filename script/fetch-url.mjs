#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Client, StreamableHTTPClientTransport, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';
import { parseArgs } from 'node:util';
import { FetchUrlError } from './fetch-url/errors.mjs';


const hostedEndpoint = 'https://app.thermus.ai/mcp';

function commandOptions(args) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      url: { type: 'string' }, reason: { type: 'string' }, endpoint: { type: 'string', default: hostedEndpoint },
      'timeout-ms': { type: 'string', default: '60000' }, 'api-key-stdin': { type: 'boolean' },
      login: { type: 'boolean' }, logout: { type: 'boolean' }, 'non-interactive': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    } }));
  } catch {
    throw new FetchUrlError('Invalid arguments. Use --help for supported options.');
  }
  if (values.help) return { help: true };
  const explicit = values['api-key-stdin'] === true || process.env.THERMUS_API_KEY !== undefined;
  const operation = controlOperation(values, explicit);
  if (operation === 'fetch') {
    httpUrl(values.url, 'page URL');
    if (values.reason === undefined || values.reason.trim() === '') throw new FetchUrlError('Supply a nonempty --reason.');
  }
  return {
    operation, explicit, url: values.url, reason: values.reason, endpoint: endpointOf(values.endpoint),
    timeoutMs: timeoutOf(values['timeout-ms']), stdin: values['api-key-stdin'] === true,
    nonInteractive: values['non-interactive'] === true,
  };
}

function controlOperation(values, explicit) {
  if (!values.login && !values.logout) return 'fetch';
  if (process.env.THERMUS_API_KEY !== undefined) throw new FetchUrlError('First unset THERMUS_API_KEY to use --login or --logout.');
  if (values.login && values.logout || explicit || values.url !== undefined || values.reason !== undefined) {
    throw new FetchUrlError('Use --login or --logout alone, without URL, reason, or explicit credentials.');
  }
  return values.login ? 'login' : 'logout';
}

function timeoutOf(value) {
  const timeout = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new FetchUrlError('The --timeout-ms value must be an integer from 100 to 300000.');
  }
  return timeout;
}

function endpointOf(value) {
  const endpoint = httpUrl(value, 'endpoint');
  if (endpoint.hash) throw new FetchUrlError('The endpoint must not contain a fragment.');
  const loopback = endpoint.hostname === 'localhost' || endpoint.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !loopback) throw new FetchUrlError('The endpoint must use HTTPS or loopback HTTP.');
  return endpoint;
}

function httpUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new FetchUrlError(`Supply a valid ${label}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new FetchUrlError(`The ${label} must use HTTP or HTTPS without embedded credentials.`);
  }
  return url;
}

const help = `Usage: node script/fetch-url.mjs --url URL --reason TEXT [options]
       node script/fetch-url.mjs --login | --logout

Call Thermus getURLAsMarkdown and print the exact Markdown to stdout.

Options:
  --url URL          Page to fetch (HTTP or HTTPS; required for fetch)
  --reason TEXT      Reason for the fetch (required for fetch)
  --endpoint URL     MCP endpoint (default: https://app.thermus.ai/mcp)
  --timeout-ms MS    Fetch deadline; explicit mode includes stdin (100..300000; default: 60000)
  --api-key-stdin    Read the Bearer credential from stdin until EOF; replaces environment input
  --login           Start fresh hosted browser OAuth and save the grant
  --logout          Delete this script's local grant; remote consent and browser sessions remain
  --non-interactive Use saved OAuth credentials or refresh without opening a browser
  --help, -h        Show this help

A present THERMUS_API_KEY or --api-key-stdin selects explicit Bearer mode.
Otherwise hosted Thermus uses Connect OAuth with a five-minute login budget.
Use --login interactively when saved credentials need recovery. No token arguments.
Customer API keys require separate backend support. Endpoint redirects are refused.
Custom and self-hosted endpoints need explicit Bearer input. Use HTTPS, or loopback HTTP.
`;

async function explicitCredential(fromStdin) {
  let credential = process.env.THERMUS_API_KEY ?? '';
  if (fromStdin) {
    credential = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      credential += chunk;
      if (credential.length > 65_536) throw new FetchUrlError('The credential is too long.');
    }
  }
  credential = credential.trim();
  if (!credential || credential.length > 65_536 || !/^[A-Za-z0-9._~+/-]+=*$/.test(credential)) {
    throw new FetchUrlError('Supply a Bearer credential through THERMUS_API_KEY or --api-key-stdin.');
  }
  return credential;
}

async function callTool(options, signal, credential) {
  signal.throwIfAborted();
  const client = new Client({ name: 'thermus-fetch-debug', version: '0.0.0' }, {
    versionNegotiation: { mode: 'auto', probe: { timeoutMs: options.timeoutMs, maxRetries: 0 } },
  });
  try {
    const transport = new StreamableHTTPClientTransport(options.endpoint, {
      authProvider: { token: async () => credential }, requestInit: { redirect: 'error' },
      fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }),
    });
    await client.connect(transport, { signal, timeout: options.timeoutMs });
    const result = await client.callTool({ name: 'getURLAsMarkdown', arguments: { url: options.url, reason: options.reason } }, { signal, timeout: options.timeoutMs });
    if (result.isError) throw new FetchUrlError('getURLAsMarkdown failed. Check the page URL and server logs.');
    if (result.content.length !== 1 || result.content[0].type !== 'text') throw new FetchUrlError('Unexpected tool result: expected one Markdown text item.');
    return result.content[0].text;
  } finally { await client.close(); }
}

async function fetchWithDeadline(options, signal, credential) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new FetchUrlError('The command timed out. Increase --timeout-ms if needed.')), options.timeoutMs);
  const bounded = AbortSignal.any([signal, deadline.signal]);
  const work = (async () => callTool(options, bounded, credential ?? await explicitCredential(options.stdin)))();
  let rejectAbort;
  const onAbort = () => rejectAbort(bounded.reason);
  const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; bounded.addEventListener('abort', onAbort, { once: true }); });
  try {
    bounded.throwIfAborted();
    return await Promise.race([work, aborted]);
  } catch (error) {
    if (bounded.aborted) throw bounded.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    if (options.stdin) process.stdin.destroy();
    await work.catch(() => undefined);
    bounded.removeEventListener('abort', onAbort);
  }
}

async function run(options, runtime, signal) {
  if (options.explicit) return process.stdout.write(await fetchWithDeadline(options, signal));
  const profile = runtime.profile ?? { endpoint: hostedEndpoint, issuer: 'https://spontaneous-mountain-26.authkit.app', clientId: 'client_01M561NFVWJDE1SQ4EFMKS38C6' };
  if (options.endpoint.href !== profile.endpoint) throw new FetchUrlError('This endpoint needs an explicit Bearer credential. OAuth is only available for hosted Thermus.');
  const { prepareOAuth } = await import('./fetch-url/oauth.mjs');
  const credential = await prepareOAuth({ ...runtime, profile, operation: options.operation, interactive: !options.nonInteractive && (runtime.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY)) }, signal);
  if (options.operation === 'logout') return process.stderr.write('Local grant deleted. Remote authorization, browser sessions, and running requests remain unchanged.\n');
  if (options.operation === 'login') return process.stderr.write('Hosted login saved.\n');
  process.stdout.write(await fetchWithDeadline(options, signal, credential));
}

function diagnostic(error) {
  if (error instanceof FetchUrlError) return error.message;
  if (error instanceof UnauthorizedError || error instanceof SdkHttpError && error.status === 401) return 'Authentication refused. Run --login for hosted OAuth, or supply a valid explicit credential.';
  if (error instanceof SdkHttpError && error.status === 403) return 'Workspace access refused. Check the authorized workspace and current Thermus access; login may not repair it.';
  if (error instanceof SdkHttpError) return `MCP HTTP request failed (status ${error.status}). Check the endpoint and server logs.`;
  return 'MCP connection or protocol failed. Check the endpoint, credential, and server logs.';
}

export async function runFetchUrlCommand(args, runtime = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(new FetchUrlError('The command was cancelled.'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const options = commandOptions(args);
    if (options.help) process.stdout.write(help);
    else await run(options, runtime, controller.signal);
    return 0;
  } catch (error) {
    process.stderr.write(`fetch-url: ${diagnostic(controller.signal.aborted ? controller.signal.reason : error)}\n`);
    return 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runFetchUrlCommand(process.argv.slice(2));
