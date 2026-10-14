// The basic MCP URL fetch work slice: a manual run with the mock provider and Axiom logs, not a test. See README.md here.
// Run it from the repository root: pnpm work-slice:basic-mcp-url-fetch
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { loadListenAddress, loadPublicUrls, type PublicUrls } from '../../../src/config/deployment-config.ts';
import { serveApplication } from '../../../src/index.ts';
import { ConsoleLogger } from '../../../src/logging/console-logger.ts';
import { axiomTestSettings, openAxiomLogging } from '../../support/axiom-test-export.ts';
import { createWorkSliceApplication } from '../../support/work-slice/work-slice-application.ts';

const runCommand = promisify(execFile);
const setupGuide = 'See docs/lightpanda-runtime.md.';
const axiomDatasetPage = 'https://app.axiom.co/thermus-ai-spao/datasets/system-log-test';

process.exitCode = await run(new ConsoleLogger());

async function run(consoleLog: ConsoleLogger): Promise<number> {
  try {
    await serveWorkSlice();
    return 0;
  } catch (error) {
    consoleLog.fatal(error);
    return 1;
  }
}

async function serveWorkSlice(): Promise<void> {
  const listen = loadListenAddress(process.env);
  if (listen.port === 0) {
    throw new Error('LISTEN_PORT must not be 0 for the work slice: the client URL must be known before the server listens.');
  }
  const urls = loadPublicUrls(process.env, 'self-hosted');
  await assertPinnedRenderer(process.env.LIGHTPANDA_BIN);
  const axiom = axiomTestSettings();
  const scopeName = `thermus-work-slice-${randomUUID()}`;
  await using owned = new AsyncDisposableStack();
  const logging = owned.adopt(openAxiomLogging(axiom, scopeName), (opened) => opened.close());
  process.stdout.write(instructions(urls, scopeName));
  await serveApplication(() => createWorkSliceApplication(process.env, logging.logger), {
    listen, publicBaseUrl: urls.publicBaseUrl, logger: logging.logger, signals: process,
  });
}

async function assertPinnedRenderer(executable: string | undefined): Promise<void> {
  if (executable === undefined || executable === '') {
    throw new Error(`Renderer setup failed: set LIGHTPANDA_BIN to the absolute path of the pinned Lightpanda 1.0.0 executable. ${setupGuide}`);
  }
  if (!isAbsolute(executable)) throw new Error(`Renderer setup failed: LIGHTPANDA_BIN must be an absolute path. ${setupGuide}`);
  let version: string;
  try {
    version = (await runCommand(executable, ['version'], { timeout: 10_000 })).stdout.trim();
  } catch (cause) {
    throw new Error(`Renderer setup failed: the LIGHTPANDA_BIN executable does not run. ${setupGuide}`, { cause });
  }
  if (version !== '1.0.0') {
    throw new Error(`Renderer setup failed: LIGHTPANDA_BIN reports Lightpanda ${version}; the work slice supports only 1.0.0. ${setupGuide}`);
  }
}

function instructions(urls: PublicUrls, scopeName: string): string {
  const endpoint = urls.mcpResourceUrl;
  return [
    '',
    `MCP endpoint: ${endpoint}`,
    '',
    'Add the server to Claude Code. Run this command in the directory where you start Claude Code, or add --scope user:',
    `  claude mcp add --transport http thermus-local ${endpoint} --header "Authorization: Bearer local-dev"`,
    'The client must send this header with each request. The mock provider accepts each Bearer token.',
    'Then start a new Claude Code session, because a session reads the tool list when it starts.',
    '',
    'Ask, for example:',
    '  Use the thermus-local tool getURLAsMarkdown to read https://example.com/ and tell me its first heading.',
    '',
    `Watch the log in Axiom: ${axiomDatasetPage}`,
    `Scope name of this run: ${scopeName}`,
    'APL filter:',
    `  ['system-log-test'] | where ['scope.name'] == "${scopeName}" | sort by _time asc`,
    'If the filter finds nothing, use this search:',
    `  ['system-log-test'] | search "work-slice fetch"`,
    '',
    'The server starts after these lines. The log goes to Axiom only. A FATAL line here means that the start failed.',
    'Stop with Ctrl+C.',
    '',
  ].join('\n');
}
