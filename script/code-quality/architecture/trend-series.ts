import type { TrendNumbers } from './trend-record.ts';

type Basis = 'maintainability' | 'measured' | 'head-derived estimate' | 'legacy unknown';
interface Sample { readonly label: string; readonly value: number; readonly basis: Basis }
export type TrendRun = [Sample, ...Sample[]];
export interface TrendSeries { readonly heading: string; readonly name: string; readonly axis: string; readonly runs: readonly TrendRun[] }

export function trendSeriesOf(stored: readonly TrendNumbers[], head: TrendNumbers): readonly TrendSeries[] {
  const records = [...stored.map((record) => ({ label: commitLabelOf(record), record })), { label: 'this pull request', record: head }];
  return [
    { heading: 'Maintainability trend', name: 'Maintainability', axis: 'Maintainability',
      runs: runsOf(records.map(({ label, record }) => sampleOf(label, record.maintainability, 'maintainability'))) },
    { heading: 'Functions ≥ 30 trend', name: 'Functions ≥ 30', axis: 'Functions at CRAP 30 or more',
      runs: runsOf(records.map(({ label, record }) => sampleOf(label, record.functionsOver30, countBasisOf(record)))) },
  ];
}

function commitLabelOf({ commit }: TrendNumbers): string {
  const prefix = commit.slice(0, 8);
  return /^[a-f0-9]{8}$/u.test(prefix) ? prefix : 'unknown';
}

function countBasisOf({ crap }: TrendNumbers): Basis {
  if (crap === undefined) return 'legacy unknown';
  return crap.kind === 'measured' ? 'measured' : 'head-derived estimate';
}

function sampleOf(label: string, value: number | undefined, basis: Basis): Sample | undefined {
  return value !== undefined && Number.isFinite(value) ? { label, value, basis } : undefined;
}

function runsOf(samples: readonly (Sample | undefined)[]): TrendRun[] {
  const runs: TrendRun[] = [];
  let run: TrendRun | undefined;
  for (const sample of samples) {
    if (sample === undefined) { run = undefined; continue; }
    if (run === undefined || run[0].basis !== sample.basis) {
      run = [sample];
      runs.push(run);
    } else { run.push(sample); }
  }
  return runs;
}
