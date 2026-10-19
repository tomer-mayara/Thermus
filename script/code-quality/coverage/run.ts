import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommandError } from '../shared/repository.ts';

// The glob and the concurrency of npm run test:unit, so that the coverage is that of the unit suite.
const unitTests = 'dist/test/unit/**/*.test.js';

export function withUnitSuiteCoverage<T>(root: string, read: (folder: string) => T): T {
  if (!existsSync(join(root, 'dist'))) throw new CommandError('dist/ does not exist. Run npm run build first.');
  const folder = mkdtempSync(join(tmpdir(), 'thermus-coverage-'));
  try {
    runUnitSuite(root, folder);
    return read(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

// The output of the suite goes to stderr, so that stdout holds only the result of the command. A test that runs this
// command sets NODE_TEST_CONTEXT; with it, the inner node --test reports to that test instead of running on its own.
function runUnitSuite(root: string, folder: string): void {
  const suites = [['--test', '--test-concurrency=1', unitTests], ['--test', 'test/unit/user-portal/**/*.test.ts']];
  for (const args of suites) runTests(root, folder, args);
}

function runTests(root: string, folder: string, args: readonly string[]): void {
  const { NODE_TEST_CONTEXT: _context, ...environment } = process.env;
  const run = spawnSync(process.execPath, args, {
    cwd: root, env: { ...environment, NODE_V8_COVERAGE: folder }, stdio: ['ignore', 2, 2],
  });
  if (run.error) throw new CommandError(`node --test did not run: ${run.error.message}`);
  if (run.status === null) throw new CommandError(`The unit suite stopped on signal ${run.signal}. No coverage is written.`);
  if (run.status !== 0) throw new CommandError(`The unit suite failed with exit status ${run.status}. No coverage is written.`);
}
