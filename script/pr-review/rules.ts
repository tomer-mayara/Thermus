import { graphRulesOf, type GraphRules } from './rules-graph.ts';
import { checkTiers } from './rules-tiers.ts';
import { currentRulesDocument } from './historical-rules.ts';
import { documentOf, globListAt, globsAt, invalidKey, numberAt, recordAt, textAt, textListAt, valueAt } from './rules-values.ts';
import { impactFlags } from './types.ts';

// crapAbsoluteOf of script/code-quality/assessment/crap-absolute.ts computes these two goals only.
const supportedCrapGoals = { new_function_above: 15, changed_legacy_function_at_or_above: 30 } as const;
// Optional, because the check takes the files from --process and --review, and an older merge base lacks the keys.
const metricsFileKeys = ['ratchet.process_outcomes', 'ratchet.review_findings'];
const earlierImpact = { architect: impactFlags.slice(0, 5), team: impactFlags.slice(5) };

// A signal that the earlier rules read as T1 Team review, and the rules of 2026-10-24 as a note to the author.
export type SignalOutcome = 'T1' | 'note';

interface PathGroup {
  readonly tier: 'T1' | 'T2';
  readonly name: string;
  readonly question: string;
  readonly paths: readonly string[];
}

// The section architecture of the rules of 2026-10-24. Its presence in the rules of the merge base selects the
// architecture facts for the candidate. registry is the registry file; decisions are the patterns of decision records.
interface ArchitectureRules {
  readonly registry: string;
  readonly decisions: readonly string[];
}

export interface DependencyRules {
  readonly manifest: string;
  readonly lockfile?: string;
}

export interface ImpactRules {
  readonly architect: readonly string[];
  readonly team: readonly string[];
}

export interface Rules {
  readonly historical?: boolean;
  readonly processPaths?: readonly string[];
  readonly protectedPaths: readonly PathGroup[];
  readonly policyQuestion: string;
  readonly contractsQuestion: string;
  readonly readPaths: readonly string[];
  readonly readRemovalPaths: readonly string[];
  readonly scopes: { readonly production: readonly string[]; readonly generated: readonly string[] };
  readonly limits: { readonly production: number; readonly total: number; readonly outcome: SignalOutcome };
  readonly skippedOrTodo: 'T1' | 'blocked';
  readonly surface: { readonly modules: readonly string[]; readonly external?: readonly string[]; readonly contractDocuments: readonly string[]; readonly snapshots?: string };
  readonly graph: GraphRules;
  readonly maintainability: { readonly newFileBelow: number; readonly existingFileDropAt: number; readonly dropOutcome: SignalOutcome };
  readonly reviewFindingsHigh: SignalOutcome;
  readonly crap: { readonly newFunctionAbove: number; readonly changedLegacyFunctionAtOrAbove: number };
  readonly impact: ImpactRules;
  readonly architecture?: ArchitectureRules;
  readonly dependencies?: DependencyRules;
}

// base applies to the candidate. head is the rules file of the candidate: the facts that it lists are declared. path
// is the path of the rules file in the repository.
export interface LoadedRules {
  readonly base: Rules;
  readonly head: Rules;
  readonly path: string;
  readonly notes: readonly string[];
  readonly trusted?: boolean;
}

export function rulesOf(text: string, where: string, source: 'head' | 'merge-base' = 'head'): Rules {
  const { document, historical } = currentRulesDocument(documentOf(text, where), where, source === 'merge-base');
  const protectedPaths = groupsOf(document, where);
  checkTiers(document, where);
  checkMetricsFiles(document, where);
  return {
    protectedPaths, historical,
    processPaths: globListAt(document, 'metrics.process_paths', where),
    policyQuestion: textAt(document, 'protected_paths.policy.question', where),
    contractsQuestion: textAt(document, 'protected_paths.contracts.question', where),
    readPaths: [...globListAt(document, 'read_paths.paths', where), ...globListAt(document, 'read_paths.moved_by_stop_rule', where)],
    readRemovalPaths: valueAt(document, 'read_paths.removal_paths') === undefined ? [] : globListAt(document, 'read_paths.removal_paths', where),
    scopes: {
      production: globListAt(document, 'scopes.production', where),
      generated: globListAt(document, 'scopes.generated', where),
    },
    limits: limitsOf(document, where),
    skippedOrTodo: valueAt(document, 'size.test_counts.more_skipped_or_todo_than_base') as 'T1' | 'blocked',
    surface: surfaceOf(document, where),
    graph: graphRulesOf(document, where),
    maintainability: maintainabilityOf(document, where),
    reviewFindingsHigh: outcomeAt(document, 'ratchet.review_findings_high', where),
    crap: crapGoalsOf(document, where),
    impact: impactOf(document, where),
    architecture: architectureOf(document, where),
    dependencies: dependenciesOf(document, where),
  };
}

function groupsOf(document: unknown, where: string): PathGroup[] {
  return Object.keys(recordAt(document, 'protected_paths', where)).map((name) => ({
    name,
    tier: textAt(document, `protected_paths.${name}.tier`, where) as 'T1' | 'T2',
    question: textAt(document, `protected_paths.${name}.question`, where),
    paths: globListAt(document, `protected_paths.${name}.paths`, where),
  }));
}

// A limit has two names: the note key of the rules of 2026-10-24, or the earlier read key, which is T1 Team review.
function signalAt(document: unknown, keys: { readonly note: string; readonly read: string }, where: string): { readonly value: number; readonly outcome: SignalOutcome } {
  const note = valueAt(document, keys.note) !== undefined;
  if (note === (valueAt(document, keys.read) !== undefined)) throw invalidKey(where, keys.note, `give ${keys.note} or ${keys.read}, one of the two`);
  return note ? { value: numberAt(document, keys.note, where), outcome: 'note' } : { value: numberAt(document, keys.read, where), outcome: 'T1' };
}

function limitsOf(document: unknown, where: string): Rules['limits'] {
  const production = signalAt(document, { note: 'size.production_lines_note_above', read: 'size.production_lines_read_above' }, where);
  const total = signalAt(document, { note: 'size.total_lines_note_above', read: 'size.total_lines_read_above' }, where);
  if (production.outcome !== total.outcome) throw invalidKey(where, 'size', 'give both limits as note keys, or both as read keys');
  return { production: production.value, total: total.value, outcome: production.outcome };
}

// Absent, the key keeps the earlier outcome T1 Team review.
function outcomeAt(document: unknown, key: string, where: string): SignalOutcome {
  const value = valueAt(document, key);
  if (value === undefined || value === 'T1') return 'T1';
  if (value === 'note') return 'note';
  throw invalidKey(where, key, 'give note or T1, or leave it out');
}

function surfaceOf(document: unknown, where: string): Rules['surface'] {
  const owners = Object.keys(recordAt(document, 'public_surface.between_packages', where));
  const modules = [
    ...textListAt(document, 'public_surface.external', where),
    ...owners.flatMap((owner) => textListAt(document, `public_surface.between_packages.${owner}`, where)),
    ...textListAt(document, 'public_surface.documented', where),
  ];
  const snapshots = valueAt(document, 'public_surface.snapshots') === undefined ? undefined : repositoryPathAt(document, 'public_surface.snapshots', where);
  return { modules, external: textListAt(document, 'public_surface.external', where), contractDocuments: globsAt(document, 'public_surface.contract_documents', where), snapshots };
}

// A file or folder of the repository, relative to its root, without a trailing slash. A typo here would make the
// check read no file and report no fact, so the key must at least name a plausible path.
function repositoryPathAt(document: unknown, key: string, where: string): string {
  const path = textAt(document, key, where).replace(/\/+$/u, '');
  if (path === '' || path.startsWith('/') || path.split('/').some((name) => name === '' || name === '.' || name === '..')) throw invalidKey(where, key, 'give a path of the repository, relative to its root');
  return path;
}

function maintainabilityOf(document: unknown, where: string): Rules['maintainability'] {
  const drop = signalAt(document, { note: 'ratchet.maintainability_index.existing_file_drop_note_at', read: 'ratchet.maintainability_index.existing_file_drop_read_at' }, where);
  return { newFileBelow: numberAt(document, 'ratchet.maintainability_index.new_file_below', where), existingFileDropAt: drop.value, dropOutcome: drop.outcome };
}

function crapGoalsOf(document: unknown, where: string): Rules['crap'] {
  return {
    newFunctionAbove: crapGoalAt(document, 'new_function_above', where),
    changedLegacyFunctionAtOrAbove: crapGoalAt(document, 'changed_legacy_function_at_or_above', where),
  };
}

function crapGoalAt(document: unknown, name: keyof typeof supportedCrapGoals, where: string): number {
  const key = `ratchet.crap.${name}`;
  const goal = numberAt(document, key, where);
  if (goal !== supportedCrapGoals[name]) throw invalidKey(where, key, `give ${supportedCrapGoals[name]}; the check supports the goals 15 and 30 only`);
  return goal;
}

function impactOf(document: unknown, where: string): ImpactRules {
  if (valueAt(document, 'impact') === undefined) return earlierImpact;
  return { architect: textListAt(document, 'impact.architect', where), team: textListAt(document, 'impact.team', where) };
}

function architectureOf(document: unknown, where: string): ArchitectureRules | undefined {
  if (valueAt(document, 'architecture') === undefined) return undefined;
  return { registry: repositoryPathAt(document, 'architecture.registry', where), decisions: globsAt(document, 'architecture.decisions', where) };
}

function dependenciesOf(document: unknown, where: string): DependencyRules | undefined {
  if (valueAt(document, 'dependencies') === undefined) return undefined;
  const lockfile = valueAt(document, 'dependencies.lockfile');
  return { manifest: repositoryPathAt(document, 'dependencies.manifest', where), ...(lockfile === undefined ? {} : { lockfile: repositoryPathAt(document, 'dependencies.lockfile', where) }) };
}

function checkMetricsFiles(document: unknown, where: string): void {
  for (const key of metricsFileKeys) {
    const value = valueAt(document, key);
    if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) throw invalidKey(where, key, 'give a non-empty text, or leave it out');
  }
}
