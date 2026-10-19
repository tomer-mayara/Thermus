// A module, not a part of script/code-quality/ast-metrics-snapshot.ts, because the later commands of
// docs/implementation/architecture-evolution-plan.md make snapshots too.
import { withAstMetricsServer } from '../mcp/session.ts';
import type { AstMetricsServer } from '../mcp/server.ts';
import { analysisReportOf } from './analysis.ts';
import { snapshotOf } from './build.ts';
import { sourceFilesOf } from './input.ts';
import type { Snapshot } from './types.ts';
import { git } from '../shared/repository.ts';

// ast-metrics groups the dependency graph of all that it analyzes, so code that grows in script/ or test/ would regroup
// the communities of src/. Both runs thus analyze src/ alone.
const analyzedFolder = 'src';

// One JSON report of "ast-metrics analyze" and one session of "ast-metrics mcp". HEAD gives the commit and the date;
// the files can hold changes that are not committed. timeoutMs is the deadline of the session.
export async function snapshotOfTree(root: string, timeoutMs: number): Promise<Snapshot> {
  const commit = git(root, ['rev-parse', '--verify', 'HEAD'], 'The repository has no commit at HEAD.').trim();
  const date = git(root, ['show', '-s', '--format=%cI', 'HEAD'], 'git show failed for HEAD.').trim();
  const files = sourceFilesOf(analysisReportOf(root, analyzedFolder), root);
  const paths = files.map((file) => file.path);
  const answers = await withAstMetricsServer({ root, folder: analyzedFolder }, timeoutMs, (server) => serverAnswersOf(server, paths));
  return snapshotOf({ commit, date, files, ...answers });
}

// All calls go to one server, because the calls of one session share one analysis. One server for each file would
// analyze the tree once for each file.
async function serverAnswersOf(server: AstMetricsServer, paths: readonly string[]) {
  const communities = await server.tool('get_communities', { with_members: true });
  const functions = new Map<string, string>();
  for (const path of paths) functions.set(path, await server.tool('get_file_metrics', { path }));
  return { communities, functions };
}
