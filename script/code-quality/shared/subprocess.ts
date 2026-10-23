import { spawnSync, type SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { CommandError, notInstalled } from './command-error.ts';
import { astMetricsBinary } from './tool-runtime.ts';

export const outputLimit = 64 * 1024 * 1024;

export function checkAstMetricsStarted(error: Error | undefined): void {
  if (error === undefined) return;
  const { code, message } = error as NodeJS.ErrnoException;
  throw new CommandError(code === 'ENOENT' ? notInstalled : `ast-metrics did not run: ${message}`);
}

export function runAstMetrics(args: readonly string[], options: Omit<SpawnSyncOptionsWithStringEncoding, 'encoding' | 'maxBuffer'>) {
  const run = spawnSync(astMetricsBinary(), args, { ...options, encoding: 'utf8', maxBuffer: outputLimit });
  checkAstMetricsStarted(run.error);
  return run;
}
