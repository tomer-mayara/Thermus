import type { DependencyIssue } from '../dependencies/types.ts';
import { textOrder } from '../shared/order.ts';
import type { MapSources } from './types.ts';

export function dependencyNoticesOf(sources: MapSources): { readonly available: boolean; readonly lines: readonly string[] } {
  const missing = (['base', 'head'] as const).filter((side) => sources[side].dependencies === undefined);
  const unavailable = missing.length === 0 ? [] : ['', `Import explanations unavailable: ${missing.join(' and ')} ${missing.length === 1 ? 'snapshot has' : 'snapshots have'} no dependency data.`];
  const issues = (['base', 'head'] as const).flatMap((side) => {
    const found = sources[side].dependencies?.issues ?? [];
    return found.length === 0 ? [] : [{ side, found }];
  });
  if (issues.length === 0) return { available: missing.length === 0, lines: unavailable };
  const counts = issues.map(({ side, found }) => `${side} has ${found.length} ${found.length === 1 ? 'issue' : 'issues'}`);
  const detail = issues.flatMap(({ side, found }) => found.toSorted(byIssue).map((issue) => issueLineOf(side, issue)));
  return {
    available: missing.length === 0,
    lines: [...unavailable, '', `Dependency evidence incomplete: ${counts.join('; ')}. A missing pair on an incomplete side does not prove an import change.`, '', ...detail],
  };
}

function byIssue(first: DependencyIssue, second: DependencyIssue): number {
  return textOrder(first.path, second.path) || textOrder(first.specifier ?? '', second.specifier ?? '') || textOrder(first.reason, second.reason);
}

function issueLineOf(side: string, issue: DependencyIssue): string {
  const specifier = issue.specifier === undefined ? '' : ` → ${codeOf(issue.specifier)}`;
  return `- ${side}: ${codeOf(issue.path)}${specifier} — ${issue.reason}.`;
}

function codeOf(value: string): string {
  const text = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
  return `<code>${text}</code>`;
}
