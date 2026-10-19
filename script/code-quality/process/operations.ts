import { prepareArchitecture } from '../architecture/operation.ts';
import { selectionOf, type Selection } from '../crap/selection.ts';
import { runCrap } from '../crap/run.ts';
import { runDelta } from '../delta/run.ts';
import { runReview } from '../review/run.ts';
import { resolveProcessCoverage } from './coverage.ts';
import type { ProcessOperations, ProcessOptions } from './types.ts';

export function processOperations(root: string, options: ProcessOptions): ProcessOperations {
  const command = { kind: 'report', ...options, paths: [], limit: 30, target: 15 } as const;
  let selection: Selection | undefined;
  let coverage: string | undefined;
  return {
    delta: () => runDelta(root, options),
    review: () => runReview(root, options),
    coverage: () => {
      selection = selectionOf(command);
      const choice = resolveProcessCoverage(root, options, selection.paths.length > 0);
      coverage = choice.file;
      return choice;
    },
    crap: () => runCrap({ ...command, coverage }, selection),
    architecture: (choice) => prepareArchitecture({
      kind: 'report', source: { kind: 'repository', ref: options.base, timeoutMs: 60_000, allowToolVersion: options.allowToolVersion },
      touched: undefined, noCoverage: choice.file === undefined, record: false, coverage: choice.file, trendStore: undefined, out: undefined,
    }, choice.file === undefined ? choice.notice : undefined),
  };
}
