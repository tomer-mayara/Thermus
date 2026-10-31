import { architectureGroups } from './architecture-facts.ts';
import type { Candidate } from './git-reads.ts';
import { anyGlobMatches } from './globs.ts';
import { undeclaredFactReasons } from './impact.ts';
import { dependencyGroups } from './package-dependencies.ts';
import type { LoadedRules } from './rules.ts';
import type { ArchitectureResult, Declaration, FactGroup, Question, Reason } from './types.ts';

const earlierSummary = 'not assessed: the rules of the merge base have no section architecture';

// compareByHand: no snapshot comparison ran, so a person compares the declarations of the surface candidates.
export interface ArchitectureOutcome {
  readonly result: ArchitectureResult;
  readonly reasons: readonly Reason[];
  readonly questions: readonly Question[];
  readonly informational: readonly string[];
  readonly compareByHand: boolean;
}

export interface SourceFacts {
  readonly declared: readonly Declaration[];
  readonly surface: readonly Reason[];
}

interface SurfaceOutcome {
  readonly reasons: readonly Reason[];
  readonly notes: readonly string[];
  readonly question: boolean;
  readonly compared: boolean;
}

// The section architecture of the merge base selects the policy. Under each policy, a stale, missing, or orphan
// declaration snapshot of HEAD blocks, because the next pull request compares with it.
export function architectureOutcome(candidate: Candidate, rules: LoadedRules, sources: SourceFacts): ArchitectureOutcome {
  const snapshots = candidate.declarationSnapshots;
  const policy = rules.base.architecture === undefined ? earlierOutcome(rules, sources) : factsOutcome(candidate, rules, sources);
  return { ...policy, reasons: [...(snapshots?.reasons ?? []), ...policy.reasons], informational: [...(snapshots?.lines ?? []), ...policy.informational] };
}

// The earlier rules: each declared dependency fact and each surface candidate is T1 Team review.
function earlierOutcome(rules: LoadedRules, sources: SourceFacts): ArchitectureOutcome {
  return {
    result: { policy: 'earlier', facts: [], summary: earlierSummary },
    reasons: [...sources.declared.map(declaredReason), ...sources.surface],
    questions: sources.surface.length > 0 ? [contractsQuestion(rules)] : [],
    informational: [],
    compareByHand: true,
  };
}

// The facts replace the declared dependency facts as reasons; the result still lists those declarations.
function factsOutcome(candidate: Candidate, rules: LoadedRules, sources: SourceFacts): ArchitectureOutcome {
  const input = { changes: candidate.changes, registry: candidate.registry, manifest: candidate.manifest, differences: candidate.declarationSnapshots?.differences ?? [] };
  const groups = [...architectureGroups(input, rules), ...dependencyGroups(input, rules)];
  const tiered = groups.flatMap((group) => group.facts.map((fact): Reason => ({ tier: group.tier, key: fact.key, fact: fact.fact })));
  const surface = surfaceOutcome(candidate, rules, sources.surface);
  return {
    result: { policy: 'facts', facts: groups.flatMap((group) => group.facts), summary: summaryOf(groups) },
    reasons: [...groups.flatMap((group) => group.blockers ?? []), ...tiered, ...surface.reasons, ...undeclaredFactReasons(candidate.impact, rules.base.impact.architect, tiered)],
    questions: surface.question ? [contractsQuestion(rules)] : [],
    informational: [...groups.flatMap((group) => group.notes ?? []), ...surface.notes],
    compareByHand: !surface.compared,
  };
}

// With a snapshot comparison, a touched public module whose declarations stay the same is a note. A changed contract
// document stays T1 Team review: the check cannot tell a prose edit from a contract edit. Without a comparison, each
// candidate stays T1 Team review, as under the earlier rules.
function surfaceOutcome(candidate: Candidate, rules: LoadedRules, surface: readonly Reason[]): SurfaceOutcome {
  const differences = candidate.declarationSnapshots?.differences;
  if (differences === undefined || rules.base.surface.snapshots === undefined) return { reasons: surface, notes: [], question: surface.length > 0, compared: false };
  const documentPatterns = [...rules.base.surface.contractDocuments, ...rules.head.surface.contractDocuments];
  const documents = surface.filter((reason) => anyGlobMatches(documentPatterns, reason.fact));
  const differing = new Set(differences.map((difference) => difference.module));
  const unchanged = surface.filter((reason) => !documents.includes(reason) && !differing.has(moduleOf(reason.fact)));
  return {
    reasons: documents,
    notes: unchanged.map((reason) => `public module touched, declarations unchanged: ${reason.fact}`),
    question: documents.length > 0 || differences.some((difference) => difference.status === 'changed'),
    compared: true,
  };
}

function moduleOf(fact: string): string {
  return fact.replace(/ \(imports changed .+\)$/u, '');
}

function summaryOf(groups: readonly FactGroup[]): string {
  const found = groups.filter((group) => group.facts.length > 0);
  if (found.length === 0) return 'T0: no architecture fact';
  return `${found.some((group) => group.tier === 'T2') ? 'T2' : 'T1'}: ${found.map((group) => group.summary).join('; ')}`;
}

function declaredReason(entry: Declaration): Reason {
  return { tier: 'T1', key: 'dependency_graph.declared', fact: `${entry.key}: ${entry.value}` };
}

function contractsQuestion(rules: LoadedRules): Question {
  return { key: 'protected_paths.contracts', question: rules.base.contractsQuestion };
}
