// A fake of the ast-metrics executable for the tests of script/ast-metrics-delta.mjs and
// script/ast-metrics-review.mjs. ast-metrics-cli-path.ts puts a shim named ast-metrics first on PATH, and the shim
// runs this file with Node. The environment gives the answers:
//   AST_METRICS_FAKE_LOG           each call adds one JSON line with its arguments and working directory to this file
//   AST_METRICS_FAKE_METRICS_FILE  the OpenMetrics text that analyze writes; {root} becomes the working directory
//   AST_METRICS_FAKE_REVIEW        the Markdown that review prints and writes
//   AST_METRICS_FAKE_STDERR        the text for stderr
//   AST_METRICS_FAKE_EXIT          the exit status (default 0)
// Like the real executable, the fake fails when the folder of a report does not exist.
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const args = process.argv.slice(2);
const settings = process.env;

function optionValue(name) {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return undefined;
  return args[index] === name ? args[index + 1] : args[index].slice(name.length + 1);
}

// The real executable is a Go program. Like Go, the fake takes the path of its working directory from PWD when PWD
// names that folder, also through a symbolic link.
function workingDirectory() {
  const pwd = settings.PWD;
  const named = pwd && isAbsolute(pwd) ? statSync(pwd, { throwIfNoEntry: false }) : undefined;
  const actual = statSync(process.cwd());
  return named && named.dev === actual.dev && named.ino === actual.ino ? pwd : process.cwd();
}

function analyze() {
  const metricsFile = settings.AST_METRICS_FAKE_METRICS_FILE;
  const metrics = metricsFile ? readFileSync(metricsFile, 'utf8') : '';
  writeFileSync(optionValue('--report-openmetrics'), metrics.replaceAll('{root}', workingDirectory()));
  if (optionValue('--compare-with') !== undefined) {
    writeFileSync(join(optionValue('--report-html'), 'compare.html'), '<!doctype html>\n<title>Comparison</title>\n');
  }
}

function review() {
  const markdown = settings.AST_METRICS_FAKE_REVIEW ?? '';
  process.stdout.write(markdown);
  writeFileSync(optionValue('--report-markdown'), markdown);
}

if (settings.AST_METRICS_FAKE_LOG) {
  appendFileSync(settings.AST_METRICS_FAKE_LOG, `${JSON.stringify({ argv: args, cwd: process.cwd() })}\n`);
}
const commands = { analyze, review };
if (Object.hasOwn(commands, args[0])) {
  commands[args[0]]();
  if (settings.AST_METRICS_FAKE_STDERR) process.stderr.write(settings.AST_METRICS_FAKE_STDERR);
  process.exitCode = Number(settings.AST_METRICS_FAKE_EXIT ?? 0);
} else {
  process.stderr.write(`ast-metrics-cli-fake: the fake has no answer for the command ${String(args[0])}.\n`);
  process.exitCode = 2;
}
