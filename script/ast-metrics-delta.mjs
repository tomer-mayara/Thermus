#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { CommandError, git, notInstalled, repositoryRoot, verifyBase } from './repository.mjs';

const help = `Usage: node script/ast-metrics-delta.mjs [--base REF] [--min SCORE] [--no-compare] [--help]

Check the maintainability score of each TypeScript file that is added or changed
against REF. The delta holds the changes from the merge base of REF and HEAD to
the working tree: committed, staged, and unstaged changes, and the new files that
git does not ignore. Deleted files are not in the delta.

The command runs ast-metrics analyze at the repository root and prints one line
for each delta file, lowest score first. The reports go to ast-report/.

Options:
  --base REF      Git ref to compare with (default: origin/main)
  --min SCORE     Goal for each file (integer 0..128; default: 85)
  --no-compare    Do not add the comparison with REF to the HTML report
  --help, -h      Show this help

Exit status 0: each measured file is at the goal or more. Exit status 1: a file
is below the goal, or the command failed. A file that ast-metrics does not
measure, such as a file with types only, is listed as "not measured" and does
not fail the check.
`;

const reportFolder = 'ast-report';
const metricsReport = `${reportFolder}/metrics.txt`;
const typeScriptFiles = ['*.ts', '*.tsx', '*.mts', '*.cts'];
const outputLimit = 64 * 1024 * 1024;

function optionsOf(args) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      base: { type: 'string', default: 'origin/main' }, min: { type: 'string', default: '85' },
      'no-compare': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    } }));
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
  if (values.help) return { help: true };
  if (!/^\d+$/.test(values.min) || Number(values.min) > 128) throw new CommandError('The --min value must be an integer from 0 to 128.');
  // git and ast-metrics would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
  return { base: values.base, min: Number(values.min), compare: values['no-compare'] !== true };
}

// Without rename detection, git lists a renamed file as an added file, so the check measures it at its new path.
function deltaFiles(root, base) {
  const changed = git(root, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=AM', '--merge-base', base, '--', ...typeScriptFiles], `git diff against ${base} failed.`);
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...typeScriptFiles], 'git ls-files failed.');
  return [...new Set(`${changed}${untracked}`.split('\0').filter((file) => file !== ''))].sort();
}

// ast-metrics fails when the folder of a report does not exist. The old metrics go first, so that a run that writes no
// metrics cannot show old scores.
function analyze(root, options) {
  mkdirSync(join(root, reportFolder), { recursive: true });
  rmSync(join(root, metricsReport), { force: true });
  const comparison = options.compare ? [`--compare-with=${options.base}`] : [];
  const args = ['analyze', ...comparison, `--report-html=./${reportFolder}`, `--report-openmetrics=./${metricsReport}`, '--report-summary=false', '.'];
  // A Go program such as ast-metrics takes its working directory from PWD when PWD names that folder. Without the root
  // in PWD, a caller that came through a symbolic link gets paths through the link, and no score matches its file.
  const run = spawnSync('ast-metrics', args, {
    cwd: root, env: { ...process.env, PWD: root }, encoding: 'utf8', maxBuffer: outputLimit, stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (run.error) throw new CommandError(run.error.code === 'ENOENT' ? notInstalled : `ast-metrics did not run: ${run.error.message}`);
  if (run.status === 0) return;
  // After a success, the list of reports on stdout is noise. After a failure, it can tell the cause.
  process.stderr.write(run.stdout);
  throw new CommandError(run.status === null ? `ast-metrics analyze stopped on signal ${run.signal}.` : `ast-metrics analyze failed with exit status ${run.status}.`);
}

function scoresOf(root) {
  let text;
  try {
    text = readFileSync(join(root, metricsReport), 'utf8');
  } catch {
    throw new CommandError(`ast-metrics wrote no ${metricsReport}.`);
  }
  const scores = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^maintainability\{path="([^"]+)"\} (\S+)$/.exec(line);
    if (match && Number.isFinite(Number(match[2]))) scores.set(relative(root, match[1]).split(sep).join('/'), Number(match[2]));
  }
  return scores;
}

function count(number, noun) {
  return `${number} ${number === 1 ? noun : `${noun}s`}`;
}

function resultLine(measured, below, unmeasured, min) {
  const rest = unmeasured === 0 ? '' : ` ${count(unmeasured, 'file')} not measured.`;
  if (below === 0) return `Result: all ${count(measured, 'file')} at ${min} or more.${rest}`;
  return `Result: ${below} of ${count(measured, 'file')} below ${min}. Goal: ${min} or more for each file.${rest}`;
}

// The check uses the score as the line shows it, with one decimal. Otherwise 84.96 reads as "85.0 below 85".
function shownScore(score) {
  return Number(score.toFixed(1));
}

function reportOf(files, scores, options) {
  const measured = files.filter((file) => scores.has(file)).sort((first, second) => scores.get(first) - scores.get(second));
  const unmeasured = files.filter((file) => !scores.has(file));
  const below = measured.filter((file) => shownScore(scores.get(file)) < options.min);
  const lines = [
    ...measured.map((file) => `  ${scores.get(file).toFixed(1)}  ${file}${below.includes(file) ? `  below ${options.min}` : ''}`),
    ...unmeasured.map((file) => `  not measured  ${file}`),
    resultLine(measured.length, below.length, unmeasured.length, options.min),
  ];
  if (options.compare) lines.push(`Comparison with ${options.base}: ${reportFolder}/compare.html`);
  return { text: `${lines.join('\n')}\n`, passed: below.length === 0 };
}

function main(args) {
  const options = optionsOf(args);
  if (options.help) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  verifyBase(root, options.base);
  const files = deltaFiles(root, options.base);
  if (files.length === 0) {
    process.stdout.write(`No TypeScript file is added or changed against ${options.base}.\n`);
    return 0;
  }
  analyze(root, options);
  const report = reportOf(files, scoresOf(root), options);
  process.stdout.write(report.text);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-delta: ${error.message}\n`);
  process.exitCode = 1;
}
