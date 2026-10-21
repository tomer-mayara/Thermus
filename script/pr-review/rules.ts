import { graphRulesOf, type GraphRules } from './rules-graph.ts';
import { checkRoutes } from './rules-routes.ts';
import { documentOf, globListAt, globsAt, numberAt, recordAt, textAt, textListAt } from './rules-values.ts';

interface PathGroup {
  readonly name: string;
  readonly question: string;
  readonly paths: readonly string[];
}

// The keys of the rules file that the check uses. The other keys are for people or for later checks.
export interface Rules {
  readonly protectedPaths: readonly PathGroup[];
  readonly policyQuestion: string;
  readonly contractsQuestion: string;
  readonly readPaths: readonly string[];
  readonly scopes: { readonly production: readonly string[]; readonly executable: readonly string[]; readonly generated: readonly string[] };
  readonly limits: { readonly production: number; readonly total: number };
  // modules holds every module that public_surface lists: external, between_packages, and documented.
  readonly surface: { readonly modules: readonly string[]; readonly contractDocuments: readonly string[] };
  readonly graph: GraphRules;
  readonly maintainability: { readonly newFileBelow: number; readonly existingFileDropReadAt: number };
}

// base applies to the candidate. head is the rules file of the candidate: the facts that it lists are declared. path
// is the path of the rules file in the repository.
export interface LoadedRules {
  readonly base: Rules;
  readonly head: Rules;
  readonly path: string;
  readonly notes: readonly string[];
}

export function rulesOf(text: string, where: string): Rules {
  const document = documentOf(text, where);
  const protectedPaths = groupsOf(document, where);
  checkRoutes(document, where, protectedPaths.map((group) => group.name));
  return {
    protectedPaths,
    policyQuestion: textAt(document, 'protected_paths.policy.question', where),
    contractsQuestion: textAt(document, 'protected_paths.contracts.question', where),
    readPaths: [...globListAt(document, 'read_paths.paths', where), ...globListAt(document, 'read_paths.moved_by_stop_rule', where)],
    scopes: {
      production: globListAt(document, 'scopes.production', where),
      executable: globListAt(document, 'scopes.executable', where),
      generated: globListAt(document, 'scopes.generated', where),
    },
    limits: { production: numberAt(document, 'size.production_lines_read_above', where), total: numberAt(document, 'size.total_lines_read_above', where) },
    surface: surfaceOf(document, where),
    graph: graphRulesOf(document, where),
    maintainability: maintainabilityOf(document, where),
  };
}

function groupsOf(document: unknown, where: string): PathGroup[] {
  return Object.keys(recordAt(document, 'protected_paths', where)).map((name) => ({
    name,
    question: textAt(document, `protected_paths.${name}.question`, where),
    paths: globListAt(document, `protected_paths.${name}.paths`, where),
  }));
}

function surfaceOf(document: unknown, where: string): Rules['surface'] {
  const owners = Object.keys(recordAt(document, 'public_surface.between_packages', where));
  const modules = [
    ...textListAt(document, 'public_surface.external', where),
    ...owners.flatMap((owner) => textListAt(document, `public_surface.between_packages.${owner}`, where)),
    ...textListAt(document, 'public_surface.documented', where),
  ];
  return { modules, contractDocuments: globsAt(document, 'public_surface.contract_documents', where) };
}

function maintainabilityOf(document: unknown, where: string): Rules['maintainability'] {
  return {
    newFileBelow: numberAt(document, 'ratchet.maintainability_index.new_file_below', where),
    existingFileDropReadAt: numberAt(document, 'ratchet.maintainability_index.existing_file_drop_read_at', where),
  };
}
