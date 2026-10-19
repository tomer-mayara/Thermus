import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CoverageSuite } from '../provenance/types.ts';
import { CommandError } from '../shared/repository.ts';
import { suiteCommands } from './suites.ts';
import { assertCompleteCapture } from './completeness.ts';

export function withSuiteCoverage<T>(root: string, request: { suite: CoverageSuite; verify?: () => void }, read: (folder: string) => T): T {
  const { suite, verify = () => {} } = request;
  const commands = suiteCommands(root, suite);
  if (!existsSync(join(root, 'dist'))) throw new CommandError('dist/ does not exist. Run npm run build first.');
  const folder = mkdtempSync(join(tmpdir(), 'thermus-coverage-'));
  try {
    const capture = { suite, folder };
    for (const args of commands) { verify(); runTests(root, capture, args); verify(); }
    assertCompleteCapture(folder);
    return read(folder);
  } finally { rmSync(folder, { recursive: true, force: true }); }
}
type SuiteCapture = { readonly suite: CoverageSuite; readonly folder: string };
function runTests(root: string, capture: SuiteCapture, args: readonly string[]): void {
  const { suite, folder } = capture;
  const { NODE_TEST_CONTEXT: _context, ...environment } = process.env;
  const preload = `--import=${new URL('./lifecycle.ts', import.meta.url).href}`;
  const run = spawnSync(process.execPath, args, {
    cwd: root, env: { ...environment, NODE_OPTIONS: `${environment.NODE_OPTIONS ?? ''} ${preload}`.trim(), NODE_V8_COVERAGE: folder }, stdio: ['ignore', 2, 2],
  });
  if (run.error) throw new CommandError(`node --test did not run: ${run.error.message}`);
  if (run.status === null) throw new CommandError(`The ${suite} suite stopped on signal ${run.signal}. No coverage is written.`);
  if (run.status !== 0) throw new CommandError(`The ${suite} suite failed with exit status ${run.status}. No coverage is written.`);
}
