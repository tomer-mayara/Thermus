// A module, not a part of script/ast-metrics-snapshot.ts, because the later commands of
// docs/implementation/architecture-evolution-plan.md make snapshots too.
import { withAstMetricsServer } from './ast-metrics-session.ts';
import type { AstMetricsServer } from './ast-metrics-server.ts';
import { analysisReportOf } from './ast-metrics-snapshot-analysis.ts';
import { snapshotOf } from './ast-metrics-snapshot-build.ts';
import { sourceFilesOf } from './ast-metrics-snapshot-report.ts';
import type { Snapshot } from './ast-metrics-snapshot-types.ts';
import { git } from './repository.ts';

// One JSON report of "ast-metrics analyze" and one session of "ast-metrics mcp". HEAD gives the commit and the date;
// the files can hold changes that are not committed. timeoutMs is the deadline of the session.
export async function snapshotOfTree(root: string, timeoutMs: number): Promise<Snapshot> {
  const commit = git(root, ['rev-parse', '--verify', 'HEAD'], 'The repository has no commit at HEAD.').trim();
  const date = git(root, ['show', '-s', '--format=%cI', 'HEAD'], 'git show failed for HEAD.').trim();
  const files = sourceFilesOf(analysisReportOf(root), root);
  const answers = await withAstMetricsServer(root, timeoutMs, (server) => serverAnswersOf(server, files.map((file) => file.path)));
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
