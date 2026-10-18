#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const help = `Usage: node script/ast-metrics-review.mjs [--base REF] [--max-findings N] [--help]

Report the ast-metrics findings that the working tree adds or makes worse
against the tree of REF. Uncommitted changes count. ast-metrics ignores each
violation that .ast-metrics-baseline.yaml at the repository root lists.

The command runs ast-metrics review at the repository root, prints its Markdown
report, and writes the same report to ast-report/review.md.

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --help, -h          Show this help

Exit status: the status of ast-metrics review, which is 1 when a finding of
high severity exists and 0 when none exists. The command also exits 1 when it
fails.
`;

class ReviewError extends Error {}

const notInstalled = 'ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.';

function optionsOf(args) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      base: { type: 'string', default: 'origin/main' }, 'max-findings': { type: 'string', default: '50' },
      help: { type: 'boolean', short: 'h' },
    } }));
  } catch {
    throw new ReviewError('Invalid arguments. Use --help for the supported options.');
  }
  if (values.help) return { help: true };
  const maxFindings = Number(values['max-findings']);
  if (!/^\d+$/.test(values['max-findings']) || maxFindings < 1 || maxFindings > 1000) {
    throw new ReviewError('The --max-findings value must be an integer from 1 to 1000.');
  }
  // git and ast-metrics would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base.startsWith('-')) throw new ReviewError('The --base value must name a git ref.');
  return { base: values.base, maxFindings };
}

function git(cwd, args, failureMessage) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.error) throw new ReviewError(run.error.code === 'ENOENT' ? 'git is not installed or not on PATH.' : `git did not run: ${run.error.message}`);
  if (run.status !== 0) {
    const gitMessage = run.stderr.trim().split('\n')[0];
    throw new ReviewError(gitMessage ? `${failureMessage} git: ${gitMessage}` : failureMessage);
  }
  return run.stdout;
}

function repositoryRoot() {
  return git(process.cwd(), ['rev-parse', '--show-toplevel'], 'Run the command inside a git working tree.').trim();
}

function verifyBase(root, base) {
  git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], `The base ref "${base}" is not a commit in this repository. Fetch it, or name another ref with --base.`);
}

// With --fail-on high, the exit status of ast-metrics is the result: 1 when a finding of high severity exists.
function review(root, options) {
  const args = [
    'review', '--base', options.base, '--format', 'markdown', '--max-findings', String(options.maxFindings),
    '--report-markdown', './ast-report/review.md', '--fail-on', 'high',
  ];
  const run = spawnSync('ast-metrics', args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.error) throw new ReviewError(run.error.code === 'ENOENT' ? notInstalled : `ast-metrics did not run: ${run.error.message}`);
  if (run.status === null) throw new ReviewError(`ast-metrics review stopped on signal ${run.signal}.`);
  return run.status;
}

function main(args) {
  const options = optionsOf(args);
  if (options.help) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  verifyBase(root, options.base);
  if (!existsSync(join(root, '.ast-metrics-baseline.yaml'))) {
    process.stderr.write('ast-metrics-review: no .ast-metrics-baseline.yaml; every existing rule violation counts as new.\n');
  }
  // ast-metrics fails when the folder of the report does not exist.
  mkdirSync(join(root, 'ast-report'), { recursive: true });
  return review(root, options);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof ReviewError)) throw error;
  process.stderr.write(`ast-metrics-review: ${error.message}\n`);
  process.exitCode = 1;
}
