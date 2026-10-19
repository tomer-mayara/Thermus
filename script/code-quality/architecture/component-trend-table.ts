import { textOrder } from '../shared/order.ts';
import type { TrendComponent } from './component-record.ts';
import { countCellOf, markdownCellOf } from './trend-cells.ts';
import type { TrendNumbers } from './trend-record.ts';
import { rowOf } from './table.ts';

export function componentTrendTableOf(stored: readonly TrendNumbers[], head: TrendNumbers): string[] {
  const records = [...stored, head];
  const names = [...new Set(records.flatMap((record) => record.components?.map(({ name }) => name) ?? []))].sort(textOrder);
  const heading = ['', '### Trend by component', ''];
  if (names.length === 0) return [...heading, 'No component history in these records.'];
  const columns = ['Component', ...stored.map(({ commit }) => markdownCellOf(commit.slice(0, 8))), 'this pull request'];
  const rows = names.map((name) => rowOf([markdownCellOf(name), ...records.map((record) => componentCellOf(record.components?.find((component) => component.name === name)))]));
  return [...heading, rowOf(columns), rowOf(columns.map(() => '---')), ...rows];
}

function componentCellOf(component: TrendComponent | undefined): string {
  return `MI ${component?.maintainability?.toFixed(1) ?? '–'}; functions ≥ 30: ${countCellOf(component)}`;
}
