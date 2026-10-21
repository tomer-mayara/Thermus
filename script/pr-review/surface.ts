import { packageOf, type FileImport } from './graph.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { Reason } from './types.ts';

// Every change to a module of public_surface is CLARIFICATION_NEEDED. A module that imports a changed file of its own package can
// show a different surface too, through a re-export or an imported type; the check follows these imports one level
// only. A changed contract document is CLARIFICATION_NEEDED. The check cannot compare the declarations, so it names the modules and
// the documents for the comparison by hand.
export function surfaceReasons(surface: Rules['surface'], imports: ReadonlyMap<string, readonly FileImport[]>, changed: readonly string[]): Reason[] {
  const modules = [...new Set(surface.modules)].flatMap((module) => [
    ...(changed.includes(module) ? [module] : []),
    ...[...new Set((imports.get(module) ?? []).map((entry) => entry.target))]
      .filter((target) => changed.includes(target) && packageOf(target) === packageOf(module))
      .map((target) => `${module} (imports changed ${target})`),
  ]);
  const documents = changed.filter((path) => anyGlobMatches(surface.contractDocuments, path));
  return [...modules, ...documents].map((fact) => ({ route: 'CLARIFICATION_NEEDED', key: 'public_surface', fact }));
}
