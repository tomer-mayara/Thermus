import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { runAstMetrics } from '../shared/subprocess.ts';
import type { DeltaMeasurement } from './report.ts';
import { CommandError } from '../shared/repository.ts';

export const reportFolder = 'ast-report';
const metricsReport = `${reportFolder}/metrics.txt`;

type AnalysisOptions = { readonly base: string; readonly compare: boolean };

// ast-metrics fails when the folder of a report does not exist. The old metrics go first, so that a run that writes no
// metrics cannot show old scores.
function analyze(root: string, options: AnalysisOptions): void {
  mkdirSync(join(root, reportFolder), { recursive: true });
  rmSync(join(root, metricsReport), { force: true });
  const comparison = options.compare ? [`--compare-with=${options.base}`] : [];
  const args = ['analyze', ...comparison, `--report-html=./${reportFolder}`, `--report-openmetrics=./${metricsReport}`, '--report-summary=false', '.'];
  // A Go program such as ast-metrics takes its working directory from PWD when PWD names that folder. Without the root
  // in PWD, a caller that came through a symbolic link gets paths through the link, and no score matches its file.
  const run = runAstMetrics(args, {
    cwd: root, env: { ...process.env, PWD: root }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (run.status === 0) return;
  // After a success, the list of reports on stdout is noise. After a failure, it can tell the cause.
  process.stderr.write(run.stdout);
  throw new CommandError(run.status === null ? `ast-metrics analyze stopped on signal ${run.signal}.` : `ast-metrics analyze failed with exit status ${run.status}.`);
}

function scoresOf(root: string): ReadonlyMap<string, number> {
  let text: string;
  try {
    text = readFileSync(join(root, metricsReport), 'utf8');
  } catch {
    throw new CommandError(`ast-metrics wrote no ${metricsReport}.`);
  }
  const scores = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^maintainability\{path="([^"]+)"\} (\S+)$/.exec(line);
    if (match && Number.isFinite(Number(match[2]))) scores.set(relative(root, match[1]).split(sep).join('/'), Number(match[2]));
  }
  return scores;
}

export function analyzeDelta(root: string, files: readonly string[], options: AnalysisOptions): DeltaMeasurement {
  analyze(root, options);
  const scores = scoresOf(root);
  const measured = files.flatMap((file) => {
    const score = scores.get(file);
    return score === undefined ? [] : [{ file, score }];
  }).sort((first, second) => first.score - second.score);
  return { measured, notMeasured: files.filter((file) => !scores.has(file)) };
}
