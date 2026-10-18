// A fake of the ast-metrics executable for the tests of script/ast-metrics-delta.ts, script/ast-metrics-review.ts,
// and script/ast-metrics-snapshot.ts. ast-metrics-cli-path.ts puts a shim named ast-metrics first on PATH, and the
// shim runs this file with Node. The environment gives the answers:
//   AST_METRICS_FAKE_LOG           each call adds one JSON line with its arguments and working directory to this file
//   AST_METRICS_FAKE_METRICS_FILE  the OpenMetrics text that analyze writes; {root} becomes the working directory
//   AST_METRICS_FAKE_JSON_FILE     the JSON report that analyze writes; {root} becomes the working directory. A
//                                  relative path names a file in the working directory, so that each tree of a test
//                                  repository can give its own report
//   AST_METRICS_FAKE_REVIEW        the Markdown that review prints and writes
//   AST_METRICS_FAKE_STDERR        the text for stderr
//   AST_METRICS_FAKE_EXIT          the exit status (default 0)
//   AST_METRICS_FAKE_DELAY_MS      analyze and review wait this long, after the call log, before they answer (default 0)
// analyze takes the folder to analyze as its last argument, such as . or src; the fake writes the same reports for each
// folder, and the call log names the folder. The snapshot command also starts "ast-metrics mcp", and one executable on
// PATH must answer both commands. So the fake runs ast-metrics-mcp-fake.ts in its own process for mcp, with the
// settings of that fake.
// Like the real executable, the fake fails when the folder of a report does not exist.
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const settings = process.env;

function optionValue(name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) return undefined;
  return args[index] === name ? args[index + 1] : args[index].slice(name.length + 1);
}

function reportPath(name: string): string {
  const path = optionValue(name);
  if (path === undefined) throw new Error(`ast-metrics-cli-fake: the call has no ${name} option.`);
  return path;
}

// The real executable is a Go program. Like Go, the fake takes the path of its working directory from PWD when PWD
// names that folder, also through a symbolic link.
function workingDirectory(): string {
  const pwd = settings.PWD;
  if (!pwd || !isAbsolute(pwd)) return process.cwd();
  const named = statSync(pwd, { throwIfNoEntry: false });
  const actual = statSync(process.cwd());
  return named && named.dev === actual.dev && named.ino === actual.ino ? pwd : process.cwd();
}

// Without an answer, the report is empty.
function writeReport(option: string, answerFile: string | undefined): void {
  const path = optionValue(option);
  if (path === undefined) return;
  const text = answerFile ? readFileSync(answerFile, 'utf8') : '';
  writeFileSync(path, text.replaceAll('{root}', workingDirectory()));
}

function analyze(): void {
  writeReport('--report-openmetrics', settings.AST_METRICS_FAKE_METRICS_FILE);
  writeReport('--report-json', settings.AST_METRICS_FAKE_JSON_FILE);
  if (optionValue('--compare-with') !== undefined) {
    writeFileSync(join(reportPath('--report-html'), 'compare.html'), '<!doctype html>\n<title>Comparison</title>\n');
  }
}

function review(): void {
  const markdown = settings.AST_METRICS_FAKE_REVIEW ?? '';
  process.stdout.write(markdown);
  writeFileSync(reportPath('--report-markdown'), markdown);
}

if (settings.AST_METRICS_FAKE_LOG) {
  appendFileSync(settings.AST_METRICS_FAKE_LOG, `${JSON.stringify({ argv: args, cwd: process.cwd() })}\n`);
}
const commandName = String(args[0]);
const command = new Map([['analyze', analyze], ['review', review]]).get(commandName);
if (commandName === 'mcp') {
  // The fake of the server reads its settings and starts to serve when it loads.
  await import(new URL('./ast-metrics-mcp-fake.ts', import.meta.url).href);
} else if (command) {
  await delay(Number(settings.AST_METRICS_FAKE_DELAY_MS ?? 0));
  command();
  if (settings.AST_METRICS_FAKE_STDERR) process.stderr.write(settings.AST_METRICS_FAKE_STDERR);
  process.exitCode = Number(settings.AST_METRICS_FAKE_EXIT ?? 0);
} else {
  process.stderr.write(`ast-metrics-cli-fake: the fake has no answer for the command ${commandName}.\n`);
  process.exitCode = 2;
}
