import { CommandError } from '../code-quality/shared/command-error.ts';
import { jsonFieldsInFile } from '../code-quality/shared/json-file.ts';
import { invalidKey, isRecord, type Values } from './rules-values.ts';

const stages = ['Delta', 'Review', 'CRAP', 'Architecture'] as const;
const statuses = ['passed', 'goal miss', 'failed', 'unavailable'] as const;
const severities = ['high', 'medium', 'low'] as const;
const completed: readonly string[] = ['passed', 'goal miss'];

export interface StageOutcome {
  readonly name: (typeof stages)[number];
  readonly status: (typeof statuses)[number];
}

export interface ReviewFinding {
  readonly severity: (typeof severities)[number];
  readonly file: string;
  readonly message: string;
}

export interface MetricsPaths {
  readonly process: string;
  readonly review: string;
}

// findings is absent when the Review stage did not complete.
export interface MetricsFiles {
  readonly outcomes: readonly StageOutcome[];
  readonly findings?: readonly ReviewFinding[];
}

interface CommitKey {
  readonly where: string;
  readonly key: string;
  readonly retake: string;
}

// A file of another commit describes another tree than the candidate. No base is compared: the process keeps
// origin/main as its base also for a stacked pull request, and the review compares with the tip of its base ref. After
// a Review stage that did not complete, the review file can be missing or older than the process.
export function metricsFilesOf(paths: MetricsPaths, head: string): MetricsFiles {
  const outcomes = processOutcomesOf(paths.process, head);
  if (!completed.includes(outcomes[stages.indexOf('Review')].status)) return { outcomes };
  return { outcomes, findings: reviewFindingsOf(paths.review, head) };
}

function processOutcomesOf(path: string, head: string): StageOutcome[] {
  const where = `The process file ${path}`;
  const fields = jsonFieldsInFile(path, 'process');
  if (fields.version !== 1) throw invalidKey(where, 'version', 'give 1');
  if (typeof fields.base !== 'string') throw invalidKey(where, 'base', 'give a text');
  checkCommit(fields, { where, key: 'head', retake: 'Run the metrics process with --json again after the last commit.' }, head);
  const { outcomes } = fields;
  if (!Array.isArray(outcomes) || outcomes.length !== stages.length) throw invalidKey(where, 'outcomes', 'give the four stages Delta, Review, CRAP, and Architecture in order');
  return outcomes.map((entry, index) => outcomeOf(isRecord(entry) ? entry : {}, index, where));
}

function outcomeOf(fields: Values, index: number, where: string): StageOutcome {
  const key = `outcomes[${index}]`;
  if (fields.name !== stages[index]) throw invalidKey(where, `${key}.name`, `give ${stages[index]}`);
  const status = statuses.find((value) => value === fields.status);
  if (status === undefined) throw invalidKey(where, `${key}.status`, 'give passed, goal miss, failed, or unavailable');
  if (typeof fields.text !== 'string') throw invalidKey(where, `${key}.text`, 'give a text');
  return { name: stages[index], status };
}

function reviewFindingsOf(path: string, head: string): ReviewFinding[] {
  const where = `The review file ${path}`;
  const fields = jsonFieldsInFile(path, 'review');
  checkCommit(fields, { where, key: 'headSha', retake: 'Run the metrics process again after the last commit.' }, head);
  if (!Array.isArray(fields.regressions)) throw invalidKey(where, 'regressions', 'give a list');
  return fields.regressions.map((entry, index) => findingOf(isRecord(entry) ? entry : {}, index, where));
}

function findingOf(fields: Values, index: number, where: string): ReviewFinding {
  const key = `regressions[${index}]`;
  const severity = severities.find((value) => value === fields.severity);
  if (severity === undefined) throw invalidKey(where, `${key}.severity`, 'give high, medium, or low');
  const file = textOf(fields.file);
  if (file === undefined) throw invalidKey(where, `${key}.file`, 'give a non-empty text');
  const message = textOf(fields.message);
  if (message === undefined) throw invalidKey(where, `${key}.message`, 'give a non-empty text');
  return { severity, file, message };
}

function checkCommit(fields: Values, commit: CommitKey, head: string): void {
  const value = fields[commit.key];
  if (typeof value !== 'string') throw invalidKey(commit.where, commit.key, 'give a text');
  if (value !== head) throw new CommandError(`${commit.where} is of commit ${value}, but the candidate is ${head}. ${commit.retake}`);
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
