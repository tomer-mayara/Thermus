import { bandRuleOf } from './bands.ts';
import { componentNameOf } from './component-name.ts';
import { componentsOf, type Component } from './component-data.ts';
import type { CrapDelta } from './crap-delta.ts';
import type { CommunityNumbers, MapNode, MapSources } from './types.ts';

export function componentNodesOf(sources: MapSources, delta: CrapDelta | undefined): MapNode[] {
  const base = new Map(componentsOf(sources.base).map((component) => [component.name, component]));
  const head = new Map(componentsOf(sources.head).map((component) => [component.name, component]));
  const paths = [...sources.touched, ...(sources.changes ?? []).flatMap((change) => [change.path, change.oldPath ?? change.path])];
  const touched = new Set(paths.map(componentNameOf));
  const bandOf = bandRuleOf(delta);
  return [...new Set([...base.keys(), ...head.keys()])].sort().flatMap((name): MapNode[] => {
    const before = base.get(name);
    const after = head.get(name);
    const component = after ?? before;
    if (component === undefined) return [];
    return [{
      label: name, status: after === undefined ? 'gone' : before === undefined ? 'new' : 'kept',
      touched: touched.has(name),
      numbers: component, change: after && before && changeOf(after, before), band: bandOf(after, before),
    }];
  });
}

function changeOf(after: Component, before: Component): CommunityNumbers {
  return {
    files: after.files - before.files,
    maintainability: after.maintainability === undefined || before.maintainability === undefined ? undefined : after.maintainability - before.maintainability,
    paths: after.paths === undefined || before.paths === undefined ? undefined : after.paths - before.paths,
  };
}
