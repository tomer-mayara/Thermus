// The summary that the file subcommand of script/ast-metrics-mcp.ts makes from the answer of get_file_metrics: a
// header with the file values, then one line for each function, lowest score first.
import { CommandError } from './repository.ts';

type JsonObject = Readonly<Record<string, unknown>>;

// Only the values that the summary prints. A value that the answer does not give is undefined.
interface FunctionMetrics {
  readonly name: string | undefined;
  readonly cyclomaticComplexity: number | undefined;
  readonly maintainabilityIndex: number | undefined;
  readonly lines: number | undefined;
}

interface FileMetrics {
  readonly cyclomaticComplexity: number;
  readonly maintainabilityIndex: number | undefined;
  readonly functions: readonly FunctionMetrics[];
}

export function fileSummary(path: string, text: string): string {
  const metrics = fileMetricsOf(text);
  // Some answers have no file-level maintainability. Then the header gives no score.
  const score = metrics.maintainabilityIndex;
  const header = [
    ...(score === undefined ? [] : [`score ${score.toFixed(1)}`]),
    plural(metrics.cyclomaticComplexity, 'decision path'),
    plural(metrics.functions.length, 'function'),
  ];
  const functions = metrics.functions.toSorted((first, second) => scoreOf(first) - scoreOf(second));
  return [`${path}: ${header.join(', ')}`, '  score  paths  lines  name', ...functions.map(functionLine)].map((line) => `${line}\n`).join('');
}

function fileMetricsOf(text: string): FileMetrics {
  const answer = jsonOf(text);
  if (!isJsonObject(answer) || !Array.isArray(answer.functions) || typeof answer.cyclomatic_complexity !== 'number') {
    throw new CommandError('get_file_metrics gave an unexpected answer. Use --json to see it.');
  }
  return {
    cyclomaticComplexity: answer.cyclomatic_complexity,
    maintainabilityIndex: maintainabilityIndexOf(answer),
    functions: answer.functions.map(functionMetricsOf),
  };
}

// An entry that is not an object gives no values, so its line shows only dashes.
function functionMetricsOf(entry: unknown): FunctionMetrics {
  const fields: JsonObject = isJsonObject(entry) ? entry : {};
  return {
    name: typeof fields.name === 'string' ? fields.name : undefined,
    cyclomaticComplexity: numberOf(fields.cyclomatic_complexity),
    maintainabilityIndex: maintainabilityIndexOf(fields),
    lines: numberOf(isJsonObject(fields.volume) ? fields.volume.loc : undefined),
  };
}

function maintainabilityIndexOf(metrics: JsonObject): number | undefined {
  return isJsonObject(metrics.maintainability) ? numberOf(metrics.maintainability.maintainability_index) : undefined;
}

// A function without a score compares as equal to each other function.
function scoreOf(entry: FunctionMetrics): number {
  return entry.maintainabilityIndex ?? Number.NaN;
}

function functionLine(entry: FunctionMetrics): string {
  const cells = [entry.maintainabilityIndex?.toFixed(1) ?? '-', entry.cyclomaticComplexity ?? '-', entry.lines ?? '-'];
  return `  ${cells.map((cell) => String(cell).padStart(5)).join('  ')}  ${entry.name || '(anonymous)'}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function jsonOf(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
