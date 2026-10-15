import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { workSliceShutdownProbe } from '../../support/processes/module-paths.ts';

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  test(`Given a slice process started by real pnpm and an outer signal forwarder, when terminal ${signal} reaches the process group and the outer forwards it again during async cleanup, then the first signal is logged, cleanup flushes, and the whole chain exits 0`, { timeout: 15_000 }, async (t) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workSliceShutdownProbe, 'outer', signal], {
      cwd: process.cwd(), detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    t.after(() => { if (child.pid !== undefined) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } });
    let output = '';
    let errors = '';
    let sent = false;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
      if (!sent && output.includes('READY')) {
        sent = true;
        assert.ok(child.pid);
        process.kill(-child.pid, signal);
      }
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { errors += chunk; });
    const [code, stoppedBy] = await once(child, 'close');

    assert.equal(stoppedBy, null, errors);
    assert.equal(code, 0, output + errors);
    assert.match(output, /READY v24\.20\.0\n/);
    assert.match(output, new RegExp(`Stopping after ${signal}\\nCLEANUP\\nFORWARDED ${signal}\\nFLUSHED\\nOUTER 0 null\\n`));
    assert.equal(errors, '');
  });
}
