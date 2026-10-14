import { pathToFileURL } from 'node:url';
import { createApplication, type Application, type ApplicationLogger } from './application.ts';
import { loadDeploymentConfig, loadListenAddress, type ListenAddress } from './config/deployment-config.ts';
import { startHttpServer } from './http/server.ts';
import { ConsoleLogger } from './logging/console-logger.ts';
import { HiddenLineInput } from './terminal/hidden-line-input.ts';

type Environment = Readonly<Record<string, string | undefined>>;

export interface ProcessSignals {
  once(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
}

export interface ServeOptions {
  readonly listen: ListenAddress;
  readonly publicBaseUrl: string;
  readonly logger: ApplicationLogger;
  readonly signals: ProcessSignals;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2), process.env, new ConsoleLogger());
}

async function run(args: readonly string[], environment: Environment, logger: ConsoleLogger): Promise<number> {
  if (args.length > 0) return runOperatorCommand(args, environment, logger);
  try {
    await serve(environment, logger, process);
    return 0;
  } catch (error) {
    logger.fatal(error);
    return 1;
  }
}

// Only an operator command loads the local commands, so the server start loads no local module before its edition branch.
async function runOperatorCommand(args: readonly string[], environment: Environment, logger: ConsoleLogger): Promise<number> {
  const { runLocalAuthCommand } = await import('./auth/local-auth/local-auth-command.ts');
  const input = new HiddenLineInput(process.stdin, process.stderr);
  try {
    return await runLocalAuthCommand(args, {
      environment, input, output: process.stdout, logger,
      openAdministration: async (settings) => {
        const { openBetterAuthAdministration } = await import('./auth/local-auth/better-auth/better-auth-user-administration.ts');
        return openBetterAuthAdministration(settings);
      },
    });
  } finally {
    input.close();
  }
}

export async function serve(environment: Environment, logger: ApplicationLogger, signals: ProcessSignals): Promise<void> {
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
