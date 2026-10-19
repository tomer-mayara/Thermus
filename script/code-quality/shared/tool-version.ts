import { spawnSync } from 'node:child_process';
import { CommandError } from './repository.ts';
import { checkAstMetricsStarted } from './subprocess.ts';

const pinnedToolVersion = '0.43.1';

export interface CheckedToolVersion {
  readonly actual: string;
  readonly allowToolVersion: boolean;
}

export interface ToolVersionPolicy {
  readonly checked?: CheckedToolVersion;
  readonly allowToolVersion?: boolean;
}

function checkedToolVersion(actual: string | undefined, allowToolVersion = false): CheckedToolVersion {
  if (!actual) throw new CommandError('ast-metrics did not report its tool version.');
  if (actual !== pinnedToolVersion && !allowToolVersion) {
    throw new CommandError(`ast-metrics ${actual} is not the pinned ${pinnedToolVersion}; run with --allow-tool-version to continue.`);
  }
  return { actual, allowToolVersion };
}

export function cliToolVersion(root: string, allowToolVersion = false): CheckedToolVersion {
  const run = spawnSync('ast-metrics', ['version'], { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 });
  checkAstMetricsStarted(run.error);
  if (run.status !== 0) throw new CommandError('ast-metrics version failed.');
  return checkedToolVersion(/^\s*Current version\s+(\S+)\s*$/mu.exec(run.stdout)?.[1], allowToolVersion);
}

export function checkServerToolVersion(actual: string | undefined, policy: ToolVersionPolicy): void {
  if (policy.checked === undefined) {
    checkedToolVersion(actual, policy.allowToolVersion);
    return;
  }
  if (actual !== policy.checked.actual) {
    throw new CommandError(`ast-metrics MCP version ${actual ?? 'unknown'} differs from the checked CLI version ${policy.checked.actual}.`);
  }
}
