import type { TrendNumbers } from './trend-record.ts';
import { trendSeriesOf, type TrendSeries, type TrendRun } from './trend-series.ts';

export function trendChartsOf(stored: readonly TrendNumbers[], head: TrendNumbers): string[] {
  return trendSeriesOf(stored, head).flatMap(metricLinesOf);
}

function metricLinesOf(metric: TrendSeries): string[] {
  const note = metric.name === 'Maintainability'
    ? 'Missing values are gaps; lines stop at each gap.'
    : 'Missing values are gaps; lines stop at each gap or change of count basis.';
  return ['', `### ${metric.heading}`, '', note, '',
    ...(metric.runs.length === 0 ? [`${metric.name} unavailable.`] : metric.runs.flatMap((run) => runLinesOf(metric, run)))];
}

function runLinesOf(metric: TrendSeries, run: TrendRun): string[] {
  const [first] = run, last = run.at(-1) ?? first;
  if (run.length === 1) return [`${first.label}: ${first.value} (${first.basis}). One point; no line.`, ''];
  const title = first.basis === 'maintainability' ? metric.axis : `${metric.axis} - ${first.basis}`;
  return [`${metric.name} (${first.basis}), ${first.label} to ${last.label}.`, '',
    '```mermaid', '---', 'config:', '  xyChart:', '    xAxis:', '      labelRotation: 45', '---', 'xychart-beta', `    title "${title}"`,
    `    x-axis [${run.map((sample) => `"${sample.label}"`).join(', ')}]`,
    `    y-axis "${metric.axis}" ${rangeOf(run)}`,
    `    line [${run.map((sample) => decimalOf(sample.value)).join(', ')}]`, '```', ''];
}

function rangeOf(run: TrendRun): string {
  const values = run.map((sample) => sample.value);
  const low = Math.min(...values), high = Math.max(...values);
  if (low !== high) return `${decimalOf(low)} --> ${decimalOf(high)}`;
  const padding = Math.max(Math.abs(low) * 0.01, 1);
  const bottom = low === 0 ? 0 : Math.max(-Number.MAX_VALUE, low - padding);
  const top = Math.min(Number.MAX_VALUE, high + padding);
  return `${decimalOf(bottom)} --> ${decimalOf(top)}`;
}

function decimalOf(value: number): string {
  return value.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 21 });
}
