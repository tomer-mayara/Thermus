import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mock } from 'node:test';

// Help must not start Git, ast-metrics, a build, or another test runner, even by absolute path.
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
  mock.method(childProcess, name, () => {
    process.stderr.write(`Child process attempted through ${name}\n`);
    throw new Error('Child processes are not allowed while reading help');
  });
}
syncBuiltinESMExports();
