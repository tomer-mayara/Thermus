import { coverageForHead } from '../architecture/coverage-compatibility.ts';
import { coverageOfRepository } from '../architecture/coverage.ts';
import { withAstMetricsServer } from '../mcp/session.ts';
import { inputIdentityOf } from '../provenance/inputs.ts';
import { CommandError } from '../shared/repository.ts';
import { measuredFunctionsOf } from './metrics.ts';
import { goalFunctionsOf } from './classification.ts';
import * as sourceTree from './source-tree.ts';
import type { Selection } from './selection.ts';
import type { GoalFunction } from './types.ts';

export async function goalRowsOf(command: { readonly coverage?: string; readonly allowToolVersion: boolean }, selection: Selection): Promise<GoalFunction[]> {
  const { root, paths } = selection;
  const identity = inputIdentityOf(root);
  const supplied = coverageOfRepository(root, command.coverage);
  const { coverage, coverageNotice } = coverageForHead(supplied, identity);
  if (coverage === undefined) throw new CommandError(coverageNotice ?? 'No coverage report. The required CRAP goals are unresolved.');
  if (coverage.files.some((file) => file.functions.some(({ coveredShare }) => !Number.isFinite(coveredShare) || coveredShare < 0 || coveredShare > 1))) throw new CommandError('The coverage report has a covered share outside 0 to 1.');
  const files = sourceTree.sourceFilesOf(selection);
  const measured = await withAstMetricsServer({ root, folder: 'src', allowToolVersion: command.allowToolVersion }, 60_000, async (server) => {
    const answers = new Map();
    for (const path of paths) {
      const declarations = files.head.find((file) => file.path === path)?.functions?.length ?? 0;
      answers.set(path, sourceTree.measuredSourceFile(root, path, measuredFunctionsOf(path, await server.tool('get_file_metrics', { path }), declarations, root)));
    }
    return answers;
  });
  if (JSON.stringify(identity) !== JSON.stringify(inputIdentityOf(root))) throw new CommandError('The inputs changed during the CRAP assessment. No report was published.');
  const head = [...files.head.filter((file) => !measured.has(file.path)), ...measured.values()];
  return goalFunctionsOf(selection, { base: files.base, head }, coverage);
}
