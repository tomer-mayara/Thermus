// OpenMetrics text in the shape that ast-metrics analyze writes: comment lines, and for each file its maintainability
// score and other metrics, with the absolute path of the file. {root} stands for the working directory of
// ast-metrics. The other metrics come after the score and have lower values, so that a wrong match changes the result.
export function metricsReportOf(scores: Readonly<Record<string, number>>): string {
  const lines = ['# HELP maintainability Maintainability of the code', '# TYPE maintainability gauge'];
  for (const [file, score] of Object.entries(scores)) {
    lines.push(`maintainability{path="{root}/${file}"} ${score}`);
    lines.push(`maintainability_without_comments{path="{root}/${file}"} 1.5`);
    lines.push(`cyclomatic_complexity{path="{root}/${file}"} 2`);
  }
  return `${lines.join('\n')}\n`;
}
