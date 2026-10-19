import { changedCommunityEdgesOf } from './community-dependencies.ts';
import type { CommunityEdgeEvidence } from './community-dependencies.ts';
import { communityMovementLinesOf } from './community-movements.ts';
import { dependencyDescriptionsOf } from './dependency-changes.ts';
import { dependencyNoticesOf } from './dependency-notices.ts';
import type { ArchitectureMap, MapSources } from './types.ts';

const pairLimit = 10;
const units = 'Tool references and deduplicated file pairs have different units. An unchanged import means the same normalized file pair, after proven path moves; evidence kinds can differ.';

export function communityEvidenceLinesOf(sources: MapSources, map: ArchitectureMap): string[] {
  const lines = ['', '### Community edge evidence', '', units];
  const notices = dependencyNoticesOf(sources);
  if (!notices.available) return [...lines, ...notices.lines, ...communityMovementLinesOf(sources)];
  const changes = dependencyDescriptionsOf(sources);
  const changed = changedCommunityEdgesOf(sources, map);
  return [
    ...lines, ...notices.lines,
    ...(changed.length === 0 ? ['', 'No new or gone community edges.'] : changed.flatMap((edge) => edgeLinesOf(changes, edge))),
    ...communityMovementLinesOf(sources),
  ];
}

function edgeLinesOf(describe: ReturnType<typeof dependencyDescriptionsOf>, { edge, pairs, side }: CommunityEdgeEvidence): string[] {
  const count = pairs.length === 0 ? '' : `; ${pairs.length} deduplicated file ${pairs.length === 1 ? 'pair' : 'pairs'}`;
  const header = `- ${edge.from.label} → ${edge.to.label} · ${edge.status}: ${edge.references} tool references${count}.`;
  if (pairs.length === 0) return ['', header, '  - No file-pair evidence for this tool edge.'];
  const evidence = pairs.slice(0, pairLimit).map((pair) => `  - \`${pair.from}\` → \`${pair.to}\` — ${describe(pair, side)}.`);
  const omitted = pairs.length - evidence.length;
  return ['', header, ...evidence, ...(omitted === 0 ? [] : [`  - ${omitted} file pairs omitted.`])];
}
