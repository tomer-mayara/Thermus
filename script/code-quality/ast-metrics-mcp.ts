#!/usr/bin/env node
import { reportFailure } from './shared/command-error.ts';
import { commandOf, help } from './mcp/command-line.ts';
import { workOf } from './mcp/output.ts';
import { withAstMetricsServer } from './mcp/session.ts';
import { repositoryRoot } from './shared/repository.ts';

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const root = repositoryRoot();
  return withAstMetricsServer({ root, allowToolVersion: command.allowToolVersion }, command.timeoutMs, workOf(command, root));
}

try {
  process.stdout.write(await main());
} catch (error) {
  reportFailure('ast-metrics-mcp', error);
}
