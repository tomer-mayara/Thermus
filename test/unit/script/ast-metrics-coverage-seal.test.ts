import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const { sealRequestIn } = await import(new URL('coverage/seal.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/coverage/seal.ts');
const request = { protocol: 'pre-crash-seal-1', captureId: 'a'.repeat(64), pid: 42, threadId: 0, nonce: '12345678-1234-1234-1234-123456789abc' };
for (const [name, change] of [
  ['zero process ID', { pid: 0 }], ['negative process ID', { pid: -1 }], ['fractional process ID', { pid: 4.2 }],
  ['negative thread ID', { threadId: -1 }], ['fractional thread ID', { threadId: 0.5 }],
  ['another protocol', { protocol: 'normal-exit' }], ['invalid capture identity', { captureId: 'bad' }], ['invalid nonce', { nonce: 'stale' }],
] as const) {
  test(`Given a seal request with ${name}, when the runtime reads it, then it cannot authorize a seal`, () => {
    assert.equal(sealRequestIn({ ...request, ...change }), undefined);
  });
}
test('Given a valid process and main thread seal request, when read from marker evidence, then only the request fields identify it', () => {
  assert.deepEqual(sealRequestIn({ ...request, state: 'sealed-before-crash', files: [] }), request);
});

const { spawnSync } = await import('node:child_process');
const { writeFileSync } = await import('node:fs');
const { join } = await import('node:path');
const { dataDirectory } = await import('../../support/isolation/data-directory.ts');
for (const [productIpc, startupDelay] of [[false, 0], [true, 0], [false, 2_500]] as const) {
  test(`Given a captured fork with ${productIpc ? 'a product message listener' : 'no product IPC work'}${startupDelay ? ' and slow startup' : ''}, when it reaches its normal end, then capture preserves its channel lifetime`, (t) => {
    const root = dataDirectory(t);
    const childFile = join(root, 'child.mjs');
    writeFileSync(childFile, productIpc
      ? "process.on('message', () => { console.log('received'); process.disconnect(); }); console.log('ready');"
      : "console.log('ready'); console.log('finished');");
    const source = `
      import { fork } from 'node:child_process';
      let ready = false;
      let phase = 'startup';
      let messageTimer;
      const fail = () => {
        clearTimeout(deadline);
        clearTimeout(messageTimer);
        console.error(phase + ' deadline exceeded');
        process.exitCode = 1;
        child.kill('SIGKILL');
      };
      let deadline = setTimeout(fail, 15_000);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${startupDelay});
      const child = fork(${JSON.stringify(childFile)}, [], { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      process.once('SIGTERM', fail);
      let output = '';
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        process.stdout.write(chunk);
        output += chunk;
        if (ready || !output.startsWith('ready\\n')) return;
        ready = true;
        phase = 'lifetime';
        clearTimeout(deadline);
        deadline = setTimeout(fail, 2_000);
        ${productIpc ? "messageTimer = setTimeout(() => child.send('go'), 150);" : ''}
      });
      child.stderr.pipe(process.stderr);
      child.once('error', (error) => { console.error(error); process.exitCode = 1; });
      child.once('close', (code, signal) => {
        clearTimeout(deadline);
        clearTimeout(messageTimer);
        process.off('SIGTERM', fail);
        if (!ready || code !== 0 || signal !== null) process.exitCode = 1;
        console.log(JSON.stringify({ code, signal }));
      });
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      env: { ...process.env, NODE_V8_COVERAGE: root, NODE_OPTIONS: `--import=${new URL('coverage/lifecycle.ts', pathToFileURL(astMetricsCoverageScript)).href}` }, encoding: 'utf8', timeout: 20_000,
    });
    const diagnostic = JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
    assert.equal(result.error, undefined, diagnostic);
    assert.equal(result.status, 0, diagnostic);
    assert.equal(result.signal, null, diagnostic);
    assert.deepEqual(result.stdout.trim().split('\n'), ['ready', productIpc ? 'received' : 'finished', '{"code":0,"signal":null}']);
  });
}
