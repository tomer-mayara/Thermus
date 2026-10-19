import { componentMapOf } from './component-map.ts';
import { componentsOf } from './component-data.ts';
import { dependencyNoticeOf } from './component-edges.ts';
import type { CrapDelta } from './crap-delta.ts';
import { mermaidOf } from './mermaid.ts';
import type { MapSources } from './types.ts';

export function componentLinesOf(sources: MapSources, delta: CrapDelta | undefined): string[] {
  const map = componentMapOf(sources, delta);
  const dependency = dependencyNoticeOf(sources);
  const unavailable = [...componentsOf(sources.base), ...componentsOf(sources.head)].some((component) => component.loc === undefined || component.paths === undefined);
  const legend = [
    'Legend: thick border = a component this pull request touched; `· new` and `· gone` = a component or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency;',
    ...(delta === undefined ? [] : ['border color = the CRAP band of the component (● good: complete assessment, no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse);']),
    'numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base. Edges count distinct importing files per target component.',
  ].join(' ');
  return ['## Components of src/', '',
    ...(dependency === undefined ? [] : [dependency, '']),
    ...(unavailable ? ['Some per-file LOC or decision paths are absent. Affected component metrics are not measured; the record component field is omitted.', ''] : []),
    ...(map.changed || dependency !== undefined ? [] : ['The component map did not change.', '']),
    ...mermaidOf(map), '', legend];
}
