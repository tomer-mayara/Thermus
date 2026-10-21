#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Client, StreamableHTTPClientTransport, SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';
import { parseArgs } from 'node:util';
import type { OAuthOptions } from '../fetch-url/helper/oauth.ts';
import { FetchUrlError } from '../fetch-url/helper/errors.ts';
import { isPublicToolFailure } from './helper/public-tool-failure.ts';
import { validateSearchText } from './helper/search-input.ts';
const hostedEndpoint = 'https://app.thermus.ai/mcp';

type CommandOptions = { operation: 'search' | 'login' | 'logout'; explicit: boolean; query?: string; reason?: string; endpoint: URL; timeoutMs: number; stdin: boolean; nonInteractive: boolean };
export type SearchRuntime = Partial<Omit<OAuthOptions, 'operation' | 'interactive'>> & { interactive?: boolean };

function commandOptions(args: readonly string[]): CommandOptions | { help: true } {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      query: { type: 'string' }, reason: { type: 'string' }, endpoint: { type: 'string', default: hostedEndpoint },
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
  if (operation === 'search') {
    validateSearchText(values.query, values.reason);
  }
  return {
    operation, explicit, query: values.query, reason: values.reason, endpoint: endpointOf(values.endpoint),
    timeoutMs: timeoutOf(values['timeout-ms']), stdin: values['api-key-stdin'] === true,
    nonInteractive: values['non-interactive'] === true,
  };
}

function controlOperation(values: { login?: boolean; logout?: boolean; query?: string; reason?: string }, explicit: boolean): CommandOptions['operation'] {
  if (!values.login && !values.logout) return 'search';
  if (process.env.THERMUS_API_KEY !== undefined) throw new FetchUrlError('First unset THERMUS_API_KEY to use --login or --logout.');
  if (values.login && values.logout || explicit || values.query !== undefined || values.reason !== undefined) {
    throw new FetchUrlError('Use --login or --logout alone, without query, reason, or explicit credentials.');
  }
  return values.login ? 'login' : 'logout';
}

function timeoutOf(value: string): number {
  const timeout = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(timeout) || timeout < 100 || timeout > 300_000) {
    throw new FetchUrlError('The --timeout-ms value must be an integer from 100 to 300000.');
  }
  return timeout;
}

function endpointOf(value: string): URL {
  const endpoint = httpUrl(value, 'endpoint');
  if (endpoint.hash) throw new FetchUrlError('The endpoint must not contain a fragment.');
  const loopback = endpoint.hostname === 'localhost' || endpoint.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !loopback) throw new FetchUrlError('The endpoint must use HTTPS or loopback HTTP.');
  return endpoint;
}

function httpUrl(value: string | undefined, label: string): URL {
  let url;
  try { url = new URL(value ?? ''); } catch { throw new FetchUrlError(`Supply a valid ${label}.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new FetchUrlError(`The ${label} must use HTTP or HTTPS without embedded credentials.`);
  }
  return url;
}

const help = `Usage: node script/search/search.ts --query TEXT --reason TEXT [options]
       node script/search/search.ts --login | --logout

Call Thermus search and print the exact Markdown to stdout.

Options:
  --query TEXT       Search query (1..512 Unicode scalar values; required for search)
  --reason TEXT      Reason for the search (1..2000 code points; required for search)
  --endpoint URL     MCP endpoint (default: https://app.thermus.ai/mcp)
  --timeout-ms MS    Search deadline; explicit mode includes stdin (100..300000; default: 60000)
  --api-key-stdin    Read the Bearer credential from stdin until EOF; replaces environment input
  --login           Start fresh hosted browser OAuth and save the grant
  --logout          Delete the shared search/fetch local grant; remote consent and browser sessions remain
  --non-interactive Use saved OAuth credentials or refresh without opening a browser
  --help, -h        Show this help

A present THERMUS_API_KEY or --api-key-stdin selects explicit Bearer mode.
Otherwise hosted Thermus uses Connect OAuth with a five-minute login budget.
Use --login interactively when saved credentials need recovery. No token arguments.
Customer API keys require separate backend support. Endpoint redirects are refused.
Custom and self-hosted endpoints need explicit Bearer input. Use HTTPS, or loopback HTTP.
`;

async function explicitCredential(fromStdin: boolean): Promise<string> {
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

async function callTool(options: CommandOptions, signal: AbortSignal, credential: string): Promise<string> {
  signal.throwIfAborted();
  const client = new Client({ name: 'thermus-search-debug', version: '0.0.0' }, {
    versionNegotiation: { mode: 'auto', probe: { timeoutMs: options.timeoutMs, maxRetries: 0 } },
  });
  try {
    const transport = new StreamableHTTPClientTransport(options.endpoint, {
      authProvider: { token: async () => credential }, requestInit: { redirect: 'error' },
      fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }),
    });
    await client.connect(transport, { signal, timeout: options.timeoutMs });
    const result = await client.callTool({ name: 'search', arguments: { query: options.query, reason: options.reason } }, { signal, timeout: options.timeoutMs });
    if (result.isError) {
      const item = result.content.length === 1 ? result.content[0] : undefined;
      const message = item?.type === 'text' && isPublicToolFailure(item.text)
        ? item.text : 'Search failed. Check the query and server logs.';
      throw new FetchUrlError(message);
    }
    if (result.content.length !== 1 || result.content[0].type !== 'text') throw new FetchUrlError('Unexpected tool result: expected one Markdown text item.');
    return result.content[0].text;
  } finally { await client.close(); }
}

async function searchWithDeadline(options: CommandOptions, signal: AbortSignal, credential?: string): Promise<string> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new FetchUrlError('The command timed out. Increase --timeout-ms if needed.')), options.timeoutMs);
  const bounded = AbortSignal.any([signal, deadline.signal]);
  const work = (async () => callTool(options, bounded, credential ?? await explicitCredential(options.stdin)))();
  let rejectAbort: (reason: unknown) => void;
  const onAbort = () => rejectAbort(bounded.reason);
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; bounded.addEventListener('abort', onAbort, { once: true }); });
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

async function run(options: CommandOptions, runtime: SearchRuntime, signal: AbortSignal): Promise<boolean | void> {
  if (options.explicit) return process.stdout.write(await searchWithDeadline(options, signal));
  const profile = runtime.profile ?? { endpoint: hostedEndpoint, issuer: 'https://spontaneous-mountain-26.authkit.app', clientId: 'client_01M561NFVWJDE1SQ4EFMKS38C6' };
  if (options.endpoint.href !== profile.endpoint) throw new FetchUrlError('This endpoint needs an explicit Bearer credential. OAuth is only available for hosted Thermus.');
  const { prepareOAuth } = await import('../fetch-url/helper/oauth.ts');
  const credential = await prepareOAuth({ ...runtime, profile, operation: options.operation === 'search' ? 'fetch' : options.operation, interactive: !options.nonInteractive && (runtime.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY)) }, signal);
  if (options.operation === 'logout') return process.stderr.write('Local grant deleted. Remote authorization, browser sessions, and running requests remain unchanged.\n');
  if (options.operation === 'login') return process.stderr.write('Hosted login saved.\n');
  process.stdout.write(await searchWithDeadline(options, signal, credential));
}

function diagnostic(error: unknown): string {
  if (error instanceof FetchUrlError) return error.message;
  if (error instanceof UnauthorizedError || error instanceof SdkHttpError && error.status === 401) return 'Authentication refused. Run --login for hosted OAuth, or supply a valid explicit credential.';
  if (error instanceof SdkHttpError && error.status === 403) return 'Workspace access refused. Check the authorized workspace and current Thermus access; login may not repair it.';
  if (error instanceof SdkHttpError) return `MCP HTTP request failed (status ${error.status}). Check the endpoint and server logs.`;
  return 'MCP connection or protocol failed. Check the endpoint, credential, and server logs.';
}

export async function runSearchCommand(args: readonly string[], runtime: SearchRuntime = {}): Promise<number> {
  const controller = new AbortController();
  const cancel = () => controller.abort(new FetchUrlError('The command was cancelled.'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const options = commandOptions(args);
    if ('help' in options) process.stdout.write(help);
    else await run(options, runtime, controller.signal);
    return 0;
  } catch (error) {
    process.stderr.write(`search: ${diagnostic(controller.signal.aborted ? controller.signal.reason : error)}\n`);
    return 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runSearchCommand(process.argv.slice(2));
