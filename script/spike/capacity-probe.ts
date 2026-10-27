#!/usr/bin/env node
// SO-01e: the capacity and memory probe of the self on-boarding plan, Slice 1. Work in progress: this first version
// parses the options and applies the guards only. The steps follow in later commits of the same pull request.
// This is a probe, not production code. Run it from the repository root: --help prints the usage.
import { UsageError } from './render-tenant-lifecycle/inputs.ts';
import { parseInputs, USAGE } from './capacity-probe/inputs.ts';
import { readSecrets } from './capacity-probe/secrets.ts';

function main(args: readonly string[]): number {
  if (args.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  try {
    const inputs = parseInputs(args);
    if (!inputs.dryRun) readSecrets(process.env);
    process.stderr.write('capacity-probe: the steps are not built yet; this version checks the options only.\n');
    return 1;
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`capacity-probe: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
