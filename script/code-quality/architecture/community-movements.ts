import { textOrder } from '../shared/order.ts';
import { fileMappingOf } from './file-correspondence.ts';
import { matchingOf } from './match.ts';
import type { Matching } from './match.ts';
import type { MapCommunity, MapSources } from './types.ts';

interface CommunityChange {
  readonly before?: MapCommunity;
  readonly after?: MapCommunity;
  readonly kind: 'regrouped' | 'unmatched';
}

interface MovementContext {
  readonly sources: MapSources;
  readonly matching: Matching;
}

export function communityMovementLinesOf(sources: MapSources): string[] {
  const paths = fileMappingOf(sources.changes).after;
  const context = { sources, matching: matchingOf(sources.base.communities, sources.head.communities, sources.changes) };
  const headPaths = new Set(sources.head.files.map((file) => file.path));
  const renamed: string[] = [];
  const communities: Record<'regrouped' | 'unmatched', string[]> = { regrouped: [], unmatched: [] };
  for (const file of sources.base.files.toSorted((first, second) => textOrder(first.path, second.path))) {
    const path = paths.get(file.path) ?? file.path;
    if (!headPaths.has(path)) continue;
    if (path !== file.path) renamed.push(`- \`${file.path}\` → \`${path}\`.`);
    const change = communityChangeOf(context, file.path, path);
    if (change !== undefined) communities[change.kind].push(movementLineOf(path, change));
  }
  return [
    ...sectionOf('Proven path moves', renamed),
    ...sectionOf('Community regrouping', communities.regrouped),
    ...sectionOf('Unmatched community identity', communities.unmatched),
  ];
}

function communityChangeOf({ sources, matching }: MovementContext, oldPath: string, path: string): CommunityChange | undefined {
  const before = sources.base.communities.find((community) => community.members.includes(oldPath));
  const after = sources.head.communities.find((community) => community.members.includes(path));
  if (before === after) return undefined;
  const target = before && matching.headOf.get(before.id);
  if (after !== undefined && target?.id === after.id) return undefined;
  const matched = target !== undefined && after !== undefined && matching.baseOf.has(after.id);
  return { before, after, kind: matched ? 'regrouped' : 'unmatched' };
}

function movementLineOf(path: string, change: CommunityChange): string {
  return `- \`${path}\`: ${change.before?.label ?? '(no community)'} → ${change.after?.label ?? '(no community)'}.`;
}

function sectionOf(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `### ${title}`, '', ...lines];
}
