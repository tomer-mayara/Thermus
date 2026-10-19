import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { astMetricsMcpFakeOnPath, knownFile } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { astMetricsMcpFake } from '../../support/processes/module-paths.ts';

test('Given the MCP double is busy without answering, when shutdown sends SIGTERM, then it releases its input and timer and exits normally', { timeout: 5_000 }, async (t) => {
  const fake = astMetricsMcpFakeOnPath(t, { mode: 'hang' });
  const child = spawn(process.execPath, [astMetricsMcpFake, 'mcp'], { env: { ...process.env, ...fake.env }, stdio: ['pipe', 'pipe', 'inherit'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { output += chunk; });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_file_metrics', arguments: { path: knownFile } } })}\n`);
  for (let attempt = 0; attempt < 100 && fake.calls().length === 0; attempt += 1) await delay(10);
  assert.equal(fake.calls().length, 1);
  const closed = once(child, 'close');
  child.kill('SIGTERM');
  assert.deepEqual(await closed, [0, null]);
  assert.equal(output, '');
  assert.deepEqual(await fake.stillRunning(), []);
});
