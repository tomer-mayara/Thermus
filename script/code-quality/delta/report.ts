type MeasuredFile = { readonly file: string; readonly score: number };

// The measured delta files, lowest score first, and the delta files that ast-metrics does not measure.
export type DeltaMeasurement = { readonly measured: readonly MeasuredFile[]; readonly notMeasured: readonly string[] };

type DeltaGroups = {
  readonly production: readonly MeasuredFile[];
  readonly belowGoal: readonly MeasuredFile[];
  readonly other: readonly MeasuredFile[];
  readonly notMeasured: readonly string[];
};

function count(number: number, noun: string): string {
  return `${number} ${number === 1 ? noun : `${noun}s`}`;
}

// The check uses the score as the line shows it, with one decimal. Otherwise 84.96 reads as "85.0 below 85".
function shownScore(score: number): number {
  return Number(score.toFixed(1));
}

// The goal applies to production code only. No test file of the repository reaches 85, so a goal there tells nothing.
function isProductionFile({ file }: MeasuredFile): boolean {
  return file.startsWith('src/');
}

function groupsOf({ measured, notMeasured }: DeltaMeasurement, min: number): DeltaGroups {
  const production = measured.filter(isProductionFile);
  return {
    production,
    belowGoal: production.filter(({ score }) => shownScore(score) < min),
    other: measured.filter((measuredFile) => !isProductionFile(measuredFile)),
    notMeasured,
  };
}

function goalResult(groups: DeltaGroups, min: number): string {
  if (groups.production.length === 0) return 'no measured production file in the delta.';
  const production = count(groups.production.length, 'production file');
  if (groups.belowGoal.length === 0) return `all ${production} at ${min} or more.`;
  return `${groups.belowGoal.length} of ${production} below ${min}. Goal: ${min} or more for each production file.`;
}

function resultLine(groups: DeltaGroups, min: number): string {
  const other = groups.other.length === 0 ? '' : ` ${count(groups.other.length, 'other file')} without a goal.`;
  const notMeasured = groups.notMeasured.length === 0 ? '' : ` ${count(groups.notMeasured.length, 'file')} not measured.`;
  return `Result: ${goalResult(groups, min)}${other}${notMeasured}`;
}

function scoreLine({ file, score }: MeasuredFile, marker: string): string {
  return `  ${score.toFixed(1)}  ${file}${marker}`;
}

export function deltaReportOf(measurement: DeltaMeasurement, min: number): { readonly text: string; readonly passed: boolean } {
  const groups = groupsOf(measurement, min);
  const lines = [
    ...groups.production.map((measured) => scoreLine(measured, groups.belowGoal.includes(measured) ? `  below ${min}` : '')),
    ...groups.other.map((measured) => scoreLine(measured, '  no goal')),
    ...groups.notMeasured.map((file) => `  not measured  ${file}`),
    resultLine(groups, min),
  ];
  return { text: `${lines.join('\n')}\n`, passed: groups.belowGoal.length === 0 };
}
