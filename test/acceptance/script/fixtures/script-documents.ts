import type { DocumentedTest } from '../../../support/drivers/script-documentation.ts';

export const exampleCommand = 'script/code-quality/ast-metrics-example.ts';
export const exampleHelp = `Usage:
  node ${exampleCommand} file <path> [--limit N]
  node ${exampleCommand} overview

Subcommands:
  call <tool> [<json arguments>]  Arguments are an object (default: {}).

Options:
  --limit N       Maximum results (default: delegated to ast-metrics)
  --timeout-ms MS  Deadline (default: 60000)
  --help, -h      Show this help
`;

export const exampleInventory: readonly DocumentedTest[] = [
  { path: 'test/unit/script/ast-metrics-example.test.ts', kind: 'ordinary', collector: false },
  { path: 'test/acceptance/script/ast-metrics-example.live.ts', kind: 'live', collector: true },
];

export const exampleReadme = `# Example commands

\`\`\`text
Usage:
  pnpm exec node ${exampleCommand} file <path> [--limit N]
  pnpm exec node ${exampleCommand} overview

Subcommands:
  call <tool> [<json arguments>]  Arguments are an object (default: {}).

Options:
  --limit N  Maximum results
             (default: delegated to ast-metrics)
  --timeout-ms MS  Deadline (default: 60000)
  --help, -h  Show this help
\`\`\`

<!-- code-quality-tests:start -->
| Kind | Test file | Collects full unit coverage |
| --- | --- | --- |
| ordinary | test/unit/script/ast-metrics-example.test.ts | no |
| live | test/acceptance/script/ast-metrics-example.live.ts | yes |
<!-- code-quality-tests:end -->
`;
