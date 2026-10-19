import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { trendViewRecords, trendViewSnapshot } from './fixtures/ast-metrics-trend-view.ts';

test('Given stored history with missing values and different count bases, when offline architecture renders it, then separate Mermaid trends preserve each gap and basis', { timeout: 20_000 }, async (t) => {
  const folder = dataDirectory(t), store = join(folder, 'metrics'), snapshot = join(folder, 'snapshot.json');
  mkdirSync(store);
  writeFileSync(snapshot, JSON.stringify(trendViewSnapshot));
  for (const record of trendViewRecords) {
    writeFileSync(join(store, `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`), JSON.stringify(record));
  }
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--head', snapshot, '--base-snapshot', snapshot, '--trend-store', store], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  const trend = result.stdout.slice(result.stdout.indexOf('## Trend of src/ on main'));
  assert.match(trend, /### Maintainability trend/u);
  assert.match(trend, /```mermaid\nxychart-beta\n[\s\S]*line \[60, 61\]/u);
  assert.match(trend, /this pull request: 66 \(maintainability\)\. One point; no line\./u);
  assert.match(trend, /### Functions ≥ 30 trend/u);
  assert.match(trend, /aaaaaaaa: 7 \(legacy unknown\)/u);
  assert.match(trend, /bbbbbbbb: 3 \(head-derived estimate\)/u);
  assert.match(trend, /cccccccc: 6 \(measured\)/u);
  assert.doesNotMatch(trend, /line \[7, 3, 6\]/u);
});
