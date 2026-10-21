#!/usr/bin/env node
import { reportCommandError } from '../code-quality/shared/command-error.ts';
import { repositoryRoot } from '../code-quality/shared/repository.ts';
import { help, optionsOf } from './command-line.ts';
import { jsonOf, markdownOf } from './report.ts';
import { runCheck } from './run.ts';

function main(args: readonly string[]): void {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return;
  }
  const result = runCheck(repositoryRoot(), options);
  process.stdout.write(options.json ? jsonOf(result) : markdownOf(result));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  reportCommandError('pr-review-check', error);
}
