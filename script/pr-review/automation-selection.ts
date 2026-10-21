export interface ValidationSelection {
  readonly unit: boolean;
  readonly buildTest: boolean;
  readonly focusedUnit: boolean;
  readonly focusedAcceptance: boolean;
  readonly source: boolean;
  readonly external: boolean;
}

// This is the initial hosted selection. Unsupported groups require the external
// trusted runner; they are never reported as passed by this offline workflow.
export function validationSelection(paths: readonly string[]): ValidationSelection {
  const source = paths.some((path) => path.startsWith('src/'));
  const unit = source || paths.some((path) => path.startsWith('test/unit/') && path !== 'test/unit/build-output.test.ts');
  const checker = paths.some((path) => path.startsWith('script/pr-review/') || path === 'docs/implementation/pr-review-rules.yaml');
  return {
    source,
    unit,
    buildTest: source || paths.includes('test/unit/build-output.test.ts'),
    focusedUnit: !unit && checker,
    focusedAcceptance: !source && (checker || paths.some((path) => /^test\/acceptance\/script\/pr-(review|automation)/.test(path))),
    external: source || paths.some(needsExternalGate),
  };
}

function needsExternalGate(path: string): boolean {
  const contracts = ['docs/testing/test-list.md', 'script/code-quality/README.md', 'script/pr-review/README.md'];
  if (contracts.includes(path)) return true;
  if (path === '.pr-impact.json') return false;
  if (['src/', 'test/acceptance/', 'test/interface/', 'test/integration/', 'test/support/'].some((prefix) => path.startsWith(prefix))) return true;
  if (path.startsWith('test/unit/')) return false;
  if (path.startsWith('script/pr-review/')) return false;
  if (['script/', 'docker/', 'migrations/', '.habit-hooks/'].some((prefix) => path.startsWith(prefix))) return true;
  return !path.endsWith('.md');
}
