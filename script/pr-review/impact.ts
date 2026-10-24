import { readFileSync } from 'node:fs';
import { CommandError } from '../code-quality/shared/command-error.ts';
import type { Revisions } from './git-reads.ts';
import { isRecord, type Values } from './rules-values.ts';
import type { ImpactRules } from './rules.ts';
import { impactFlags, type ImpactFlag, type Reason } from './types.ts';

// uncertain selects no tier of its own: it is T1 Team review and blocked under each policy.
type ClassificationFlag = ImpactFlag | 'uncertain';
const classificationFlags: readonly ClassificationFlag[] = [...impactFlags, 'uncertain'];

export interface ArchitectureImpact {
  readonly version: 1;
  readonly base: string;
  readonly head: string;
  readonly classification: Readonly<Record<ClassificationFlag, boolean>>;
  readonly architecture: { readonly modelUpdated: boolean; readonly summary: string; readonly views: readonly string[]; readonly evidence: readonly string[] };
}

export function impactOf(path: string, revisions: Revisions): ArchitectureImpact {
  let value: unknown;
  try { value = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new CommandError(`The architecture impact file ${path} must be readable JSON.`); }
  const fields = candidateFields(value, revisions, path);
  return {
    version: 1, base: revisions.mergeBase, head: revisions.head,
    classification: classificationOf(fields.classification, path),
    architecture: architectureOf(fields.architecture, path),
  };
}

function candidateFields(value: unknown, revisions: Revisions, where: string): Values {
  if (!isRecord(value) || value.version !== 1 || value.base !== revisions.mergeBase || value.head !== revisions.head) {
    throw new CommandError(`The architecture impact ${where} must have version 1, base ${revisions.mergeBase}, and head ${revisions.head}.`);
  }
  return value;
}

// An unknown flag is an error too, so that a misspelled flag cannot leave its tier out.
function classificationOf(flags: unknown, where: string): ArchitectureImpact['classification'] {
  const exact = isRecord(flags) && Object.keys(flags).length === classificationFlags.length && classificationFlags.every((key) => typeof flags[key] === 'boolean');
  if (!exact) throw new CommandError(`The architecture impact ${where} must give exactly the classification flags ${classificationFlags.join(', ')}, each as a boolean.`);
  return flags as ArchitectureImpact['classification'];
}

function architectureOf(architecture: unknown, where: string): ArchitectureImpact['architecture'] {
  if (!isRecord(architecture) || typeof architecture.modelUpdated !== 'boolean' || !text(architecture.summary) || !texts(architecture.views) || !texts(architecture.evidence)) {
    throw new CommandError(`The architecture impact ${where} must give modelUpdated, a summary, checked views, and evidence.`);
  }
  return { modelUpdated: architecture.modelUpdated, summary: architecture.summary, views: architecture.views, evidence: architecture.evidence };
}

// The rules of the merge base give the tier of each flag: architect flags are T2 Need architect, team flags T1 Team
// review.
export function impactReasons(impact: ArchitectureImpact | undefined, flags: ImpactRules): Reason[] {
  if (impact === undefined) return [
    { tier: 'T1', key: 'impact.missing', fact: 'Architecture impact is not recorded for this candidate.' },
    { blocking: true, key: 'impact.missing', fact: 'Give --impact with the current candidate and merge base.' },
  ];
  const raised = (names: readonly string[], tier: 'T1' | 'T2') => names.filter((name) => isSet(impact, name))
    .map((name): Reason => ({ tier, key: `impact.${name}`, fact: impact.architecture.summary }));
  return [
    ...raised(flags.architect, 'T2'),
    ...raised([...flags.team, 'uncertain'], 'T1'),
    ...(impact.classification.uncertain ? [{ blocking: true as const, key: 'impact.uncertain', fact: 'Resolve the classification question and refresh the evidence.' }] : []),
  ];
}

// The summary of the declaration is the first text that the architect reads, so a fact of the section architecture
// needs an architect flag. A missing declaration is blocked already.
export function undeclaredFactReasons(impact: ArchitectureImpact | undefined, architect: readonly string[], reasons: readonly Reason[]): Reason[] {
  const fact = reasons.some((reason) => reason.tier === 'T2' && reason.key.startsWith('architecture.'));
  if (impact === undefined || !fact || architect.some((name) => isSet(impact, name))) return [];
  return [{ blocking: true, key: 'architecture.undeclared_fact', fact: 'Set the matching architect flag in .pr-impact.json and describe the change in its summary' }];
}

// The rules reader accepts only the names of impactFlags under impact.
function isSet(impact: ArchitectureImpact, name: string): boolean {
  return impact.classification[name as ClassificationFlag] === true;
}

function text(value: unknown): value is string { return typeof value === 'string' && value.trim() !== ''; }
function texts(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.every(text); }
