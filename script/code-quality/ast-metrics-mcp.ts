#!/usr/bin/env node
import { commandOf } from './mcp/command-line.ts';
import { workOf } from './mcp/output.ts';
import { withAstMetricsServer } from './mcp/session.ts';
import { CommandError, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-mcp.ts <subcommand> [options]

Start the MCP server of ast-metrics ("ast-metrics mcp") in the repository root,
make one call, print the answer, and stop the server.

Subcommands:
  file <path> [--json]                       get_file_metrics. The path is relative to the
                                             current folder, or absolute in the root. Prints
                                             the file score and each function, lowest score first.
  complex [--limit N] [--max-cyclomatic N]   find_complex_code, printed as JSON
  risky [--limit N]                          find_risky_code, printed as JSON
  overview                                   analyze_project, printed as JSON
  tools                                      The tools of the server and their descriptions
  call <tool> [<json arguments>]             Any tool. The arguments are a JSON object (default: {}).

Options:
  --json              file: print the answer of the server as JSON
  --limit N           complex, risky: the maximum number of results (default: delegated to ast-metrics)
  --max-cyclomatic N  complex: show the items above this complexity (default: delegated to ast-metrics)
  --timeout-ms MS     Deadline of the MCP call (100..300000; default: 60000)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help

The score is the maintainability index (0 to 128; more is better). The paths are the
decision paths (cyclomatic complexity). The lines column is a count of lines of
code (LOC), not a source position.
`;

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const root = repositoryRoot();
  return withAstMetricsServer({ root, allowToolVersion: command.allowToolVersion }, command.timeoutMs, workOf(command, root));
}

try {
  process.stdout.write(await main());
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic is one line, also when the server wrote several lines.
  process.stderr.write(`ast-metrics-mcp: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
