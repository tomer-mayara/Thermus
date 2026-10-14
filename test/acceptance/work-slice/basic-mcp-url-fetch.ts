// The basic MCP URL fetch work slice: a manual run with the mock provider and Axiom logs, not a test. See README.md here.
// Run it from the repository root: pnpm work-slice:basic-mcp-url-fetch
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { ConsoleLogger } from '../../../src/logging/console-logger.ts';
import { axiomTestSettings } from '../../support/axiom-test-export.ts';
import { openAxiomLogging } from '../../support/work-slice/work-slice-logger.ts';
import { startWorkSliceServer } from '../../support/work-slice/work-slice-server.ts';
import { readWorkSliceSettings, type WorkSliceSettings } from '../../support/work-slice/work-slice-settings.ts';

interface ProcessSignals {
  once(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}

const runCommand = promisify(execFile);
const setupGuide = 'See docs/lightpanda-runtime.md.';
const axiomDatasetPage = 'https://app.axiom.co/thermus-ai-spao/datasets/system-log-test';

process.exitCode = await run(new ConsoleLogger());

async function run(consoleLog: ConsoleLogger): Promise<number> {
  try {
    await serveWorkSlice();
    return 0;
  } catch (error) {
    consoleLog.fatal(failureMessage(error));
    return 1;
  }
}

async function serveWorkSlice(): Promise<void> {
  const settings = readWorkSliceSettings(process.env);
  await assertPinnedRenderer(settings.lightpandaBin);
  const axiom = axiomTestSettings();
  const scopeName = `thermus-work-slice-${randomUUID()}`;
  await using owned = new AsyncDisposableStack();
  const logging = owned.adopt(openAxiomLogging(axiom, scopeName), (opened) => opened.close());
  const server = owned.adopt(await startWorkSliceServer(settings, logging.logger), (started) => started.close());
  // A caller can send a stop signal as soon as the "Listening on" line appears, so register the stop handlers first.
  using stopped = stopSignal(process);
  logging.logger.info(`Listening on ${server.url.origin}`);
  process.stdout.write(instructions(settings, scopeName));
  const signal = await stopped.received;
  logging.logger.info(`Stopping after ${signal}`);
}

async function assertPinnedRenderer(executable: string): Promise<void> {
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

function instructions(settings: WorkSliceSettings, scopeName: string): string {
  const endpoint = settings.mcpResourceUrl;
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
    'Stop with Ctrl+C.',
    '',
  ].join('\n');
}

// Copies of stopSignal() and failureMessage() of src/index.ts, which does not export them.
function stopSignal(signals: ProcessSignals): Disposable & { readonly received: Promise<NodeJS.Signals> } {
  const received = Promise.withResolvers<NodeJS.Signals>();
  let registered = true;
  const dispose = (): void => {
    if (registered) {
      registered = false;
      signals.off('SIGINT', stop);
      signals.off('SIGTERM', stop);
    }
  };
  const stop = (signal: NodeJS.Signals): void => {
    dispose();
    received.resolve(signal);
  };
  signals.once('SIGINT', stop);
  signals.once('SIGTERM', stop);
  return { received: received.promise, [Symbol.dispose]: dispose };
}

function failureMessage(error: unknown): string {
  if (error instanceof SuppressedError) {
    return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
