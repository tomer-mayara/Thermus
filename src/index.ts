import { pathToFileURL } from 'node:url';
import { createApplication } from './application.ts';
import { loadDeploymentConfig, loadListenAddress } from './config/deployment-config.ts';
import { startHttpServer } from './http/server.ts';
import { ConsoleLogger } from './logging/console-logger.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2), process.env, new ConsoleLogger());
}

async function run(args: readonly string[], environment: Environment, logger: ConsoleLogger): Promise<number> {
  if (args.length > 0) {
    logger.error('Unknown command. Run magumagu without arguments to start the server.');
    return 2;
  }
  try {
    await serve(environment, logger);
    return 0;
  } catch (error) {
    logger.fatal(failureMessage(error));
    return 1;
  }
}

async function serve(environment: Environment, logger: ConsoleLogger): Promise<void> {
  const config = loadDeploymentConfig(environment, 'http');
  const listen = loadListenAddress(environment);
  await using owned = new AsyncDisposableStack();
  const application = owned.adopt(await createApplication(config, logger), (started) => started.close());
  const server = owned.adopt(
    await startHttpServer(application.handle, { listen, publicBaseUrl: config.publicBaseUrl, logger }),
    (listening) => listening.close(),
  );
  logger.info(`Listening on ${server.url.origin}`);
  const signal = await stopSignal();
  logger.info(`Stopping after ${signal}`);
}

function stopSignal(): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const stop = (signal: NodeJS.Signals): void => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve(signal);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

function failureMessage(error: unknown): string {
  if (error instanceof SuppressedError) {
    return `${failureMessage(error.suppressed)} The cleanup after this failure also failed: ${failureMessage(error.error)}`;
  }
  return error instanceof Error ? error.message : String(error);
}
