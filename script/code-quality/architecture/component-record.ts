import { componentsOf, type Component } from './component-data.ts';
import type { FileCrap } from './crap.ts';
import { totalCountOf } from './risk-counts.ts';
import { trendBasisOf, type TrendCoverage, type TrendCrapBasis } from './trend-basis.ts';
import type { MapSnapshot } from './types.ts';

export interface TrendComponent {
  readonly name: string;
  readonly files: number;
  readonly loc: number;
  readonly maintainability?: number;
  readonly paths: number;
  readonly functionsOver30?: number;
  readonly crap?: TrendCrapBasis;
}

export function componentRecordsOf(snapshot: MapSnapshot, files: ReadonlyMap<string, FileCrap> | undefined, coverage?: TrendCoverage): TrendComponent[] | undefined {
  const components = componentsOf(snapshot);
  if (!components.every(hasMetrics)) return undefined;
  return components.map((component) => componentRecordOf(component, files, coverage));
}

function componentRecordOf(component: Component & { readonly loc: number; readonly paths: number }, files: ReadonlyMap<string, FileCrap> | undefined, coverage?: TrendCoverage): TrendComponent {
  const { name, members, loc, paths, maintainability } = component;
  const memberFiles = members.flatMap((member) => {
    const file = files?.get(member);
    return file === undefined || file.incomplete !== undefined ? [] : [[member, file] as const];
  });
  const assessed = memberFiles.length === members.length && coverage !== undefined ? new Map(memberFiles) : undefined;
  return {
    name, files: members.length, loc, maintainability, paths,
    ...(assessed === undefined || coverage === undefined ? {} : { functionsOver30: totalCountOf(assessed), crap: trendBasisOf(coverage, assessed) }),
  };
}

function hasMetrics(component: Component): component is Component & { readonly loc: number; readonly paths: number } {
  return component.loc !== undefined && component.paths !== undefined;
}
