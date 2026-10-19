#!/usr/bin/env node
import { reportCommandError } from './shared/command-error.ts';
import { help, optionsOf } from './delta/command-line.ts';
import { runDelta } from './delta/run.ts';
import { repositoryRoot } from './shared/repository.ts';

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const report = runDelta(repositoryRoot(), options);
  process.stdout.write(report.text);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  reportCommandError('ast-metrics-delta', error);
}
