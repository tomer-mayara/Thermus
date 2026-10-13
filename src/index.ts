import { pathToFileURL } from 'node:url';
import { createApplication, type ApplicationLogger } from './application.ts';
import { loadDeploymentConfig, loadListenAddress } from './config/deployment-config.ts';
import { startHttpServer } from './http/server.ts';
import { ConsoleLogger } from './logging/console-logger.ts';
import { HiddenLineInput } from './terminal/hidden-line-input.ts';

type Environment = Readonly<Record<string, string | undefined>>;

interface ProcessSignals {
  once(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
  off(signal: NodeJS.Signals, listener: NodeJS.SignalsListener): unknown;
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
    logger.fatal(failureMessage(error));
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
  await using owned = new AsyncDisposableStack();
  const application = owned.adopt(await createApplication(config, logger), (started) => started.close());
  const server = owned.adopt(
    await startHttpServer(application.handle, { listen, publicBaseUrl: config.publicBaseUrl, logger }),
    (listening) => listening.close(),
  );
  // A caller can send a stop signal as soon as the "Listening on" line appears, so register the stop handlers first.
  const stopped = stopSignal(signals);
  logger.info(`Listening on ${server.url.origin}`);
  const signal = await stopped;
  logger.info(`Stopping after ${signal}`);
}

function stopSignal(signals: ProcessSignals): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const stop = (signal: NodeJS.Signals): void => {
      signals.off('SIGINT', stop);
      signals.off('SIGTERM', stop);
      resolve(signal);
    };
    signals.once('SIGINT', stop);
    signals.once('SIGTERM', stop);
  });
}

function failureMessage(error: unknown): string {
  if (error instanceof SuppressedError) {
    return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
