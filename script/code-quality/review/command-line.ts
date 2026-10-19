import { checkBaseRef, parseCommandArguments } from '../shared/command-line.ts';
import { CommandError } from '../shared/repository.ts';
import type { ReviewOptions } from './run.ts';

export const help = `Usage: node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--allow-tool-version] [--help]

Report the ast-metrics findings that the working tree adds or makes worse
against the tree of REF. Uncommitted changes count. ast-metrics ignores each
violation that .ast-metrics-baseline.yaml at the repository root lists.

The command runs ast-metrics review at the repository root, prints its Markdown
report, and writes fresh reports to ast-report/review.md and ast-report/review.json.
The wrapper warns for new functions above ten paths and keeps native high
severity at 25 paths. It also blocks new resolved imports from
src/html-cleaner-pipeline/ to src/mcp/, and from src/website-fetcher/ to src/auth/.
Layer rules compare with the merge base. Uncertain imports in affected guarded
sources fail the command. Adjusted JSON retains the complete nativeReview.
The native baseline does not suppress these resolved-path checks.

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help

Exit status 0: a complete review has no finding of high severity. Exit status 1:
a high finding exists, or the command failed. Missing, malformed, incomplete, or
inconsistent review results are command failures.
`;

const optionShape = {
  base: { type: 'string', default: 'origin/main' }, 'max-findings': { type: 'string', default: '50' },
  'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

export function optionsOf(args: readonly string[]): ReviewOptions | { readonly help: true } {
  const values = parseCommandArguments({ args, options: optionShape }).values;
  if (values.help) return { help: true };
  const maxFindings = Number(values['max-findings']);
  if (!/^\d+$/.test(values['max-findings']) || maxFindings < 1 || maxFindings > 1000) {
    throw new CommandError('The --max-findings value must be an integer from 1 to 1000.');
  }
  checkBaseRef(values.base);
  return { base: values.base, maxFindings, allowToolVersion: values['allow-tool-version'] === true };
}
