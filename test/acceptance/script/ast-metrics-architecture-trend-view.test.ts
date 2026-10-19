import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import * as trendView from './fixtures/ast-metrics-trend-view.ts';

test('Given three records with PR titles, component changes, gaps and count provenance, when offline architecture runs, then its full trend Markdown preserves the numbers and unknown history', { timeout: 20_000 }, async (t) => {
  const folder = dataDirectory(t), store = join(folder, 'metrics'), snapshot = join(folder, 'snapshot.json');
  mkdirSync(store);
  writeFileSync(snapshot, JSON.stringify(trendView.trendViewSnapshot));
  for (const record of [...trendView.trendViewRecords].reverse()) {
    writeFileSync(join(store, `${record.date.slice(0, 10)}-${record.commit.slice(0, 8)}.json`), JSON.stringify(record));
  }
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--head', snapshot, '--base-snapshot', snapshot, '--trend-store', store], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  const trend = result.stdout.slice(result.stdout.indexOf('## Trend of src/ on main'));
  assert.equal(trend, trendView.trendViewMarkdown);
});
