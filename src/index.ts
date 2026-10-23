import type { SystemLog } from './logs/system/system-log.ts';
import { pathToFileURL } from 'node:url';
import { createApplication, type Application } from './app/application.ts';
import { loadDeploymentConfig, loadListenAddress, type ListenAddress } from './runtime/config/deployment-config.ts';
import { startHttpServer } from './runtime/http/server.ts';
import { ConsoleSystemLogger } from './logs/system/console-system-logger.ts';
import { HiddenLineInput } from './app/hidden-line-input.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface ProcessSignals {
  once(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}

export interface ServeOptions {
  readonly listen: ListenAddress;
  readonly publicBaseUrl: string;
  readonly logger: SystemLog;
  readonly signals: ProcessSignals;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2), process.env, new ConsoleSystemLogger());
}

async function run(args: readonly string[], environment: Environment, logger: ConsoleSystemLogger): Promise<number> {
  if (args.length > 0) return runOperatorCommand(args, environment, logger);
  using deadline = environment.DEPLOYMENT === 'hosted' ? hostedShutdownDeadline(logger) : undefined;
  try {
    await serve(environment, logger, process);
    return 0;
  } catch (error) {
    logger.fatal(error);
    return 1;
  }
}

// Only an operator command loads the local commands, so the server start loads no local module before its edition branch.
async function runOperatorCommand(args: readonly string[], environment: Environment, logger: ConsoleSystemLogger): Promise<number> {
  const { runLocalAuthCommand } = await import('./interfaces/cli/local-auth-command.ts');
  const input = new HiddenLineInput(process.stdin, process.stderr);
  try {
    return await runLocalAuthCommand(args, {
      environment, input, output: process.stdout, logger,
      openAdministration: async (settings) => {
        const { openBetterAuthAdministration } = await import('./accounts/providers/better-auth/better-auth-user-administration.ts');
        return openBetterAuthAdministration(settings);
      },
    });
  } finally {
    input.close();
  }
}

export async function serve(environment: Environment, logger: SystemLog, signals: ProcessSignals): Promise<void> {
  const config = loadDeploymentConfig(environment, 'http');
  const listen = loadListenAddress(environment);
  await serveApplication(() => createApplication(config, logger, environment), { listen, publicBaseUrl: config.publicBaseUrl, logger, signals });
}

export async function serveApplication(open: () => Application | Promise<Application>, options: ServeOptions): Promise<void> {
  const { listen, publicBaseUrl, logger, signals } = options;
  await using owned = new AsyncDisposableStack();
  let listenerDrain: Promise<void> | undefined;
  const application = owned.adopt(await open(), (started) => started.close(listenerDrain));
  const server = await startHttpServer(application.handle, { listen, publicBaseUrl, logger });
  // Start listener drain, then cancel application work before waiting for the drain.
  owned.defer(() => { listenerDrain = server.close(); });
  // A caller can send a stop signal as soon as the "Listening on" line appears, so register the stop handlers first.
  using stopped = stopSignal(signals);
  logger.info(`Listening on ${server.url.origin}`);
  const signal = await stopped.received;
  logger.info(`Stopping after ${signal}`);
}

export type StopSignal = Disposable & { readonly received: Promise<NodeJS.Signals> };

// A dispose also removes both listeners when no signal came, so that a failed start leaves no listener behind.
export function stopSignal(signals: ProcessSignals): StopSignal {
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

// Keep the deadline alive while cleanup runs, then unreference it so a clean process exits naturally.
// Leave the timer installed after cleanup: a provider can leave a socket or another handle alive.
function hostedShutdownDeadline(logger: SystemLog): Disposable {
  const deadlineMs = 10_000;
  let deadline: NodeJS.Timeout | undefined;
  const arm = (): void => {
    if (deadline !== undefined) return;
    deadline = setTimeout(() => {
      try { logger.error(`Hosted shutdown exceeded ${deadlineMs} ms`); } finally { process.exit(1); }
    }, deadlineMs);
  };
  process.once('SIGINT', arm);
  process.once('SIGTERM', arm);
  return { [Symbol.dispose]: () => { process.off('SIGINT', arm); process.off('SIGTERM', arm); deadline?.unref(); } };
}
