import { readFileSync } from 'node:fs';
import { CommandError } from '../code-quality/shared/command-error.ts';
import type { Revisions } from './git-reads.ts';
import { isRecord, type Values } from './rules-values.ts';
import type { Reason } from './types.ts';

const architectureFlags = ['container', 'external', 'contract', 'deployment', 'crossCutting'] as const;
const teamFlags = ['component', 'internalInterface', 'sensitiveBehavior', 'dependencyRisk', 'policy', 'uncertain'] as const;
type ImpactFlag = typeof architectureFlags[number] | typeof teamFlags[number];

export interface ArchitectureImpact {
  readonly version: 1;
  readonly base: string;
  readonly head: string;
  readonly classification: Readonly<Record<ImpactFlag, boolean>>;
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

function classificationOf(flags: unknown, where: string): ArchitectureImpact['classification'] {
  if (!isRecord(flags) || ![...architectureFlags, ...teamFlags].every((key) => typeof flags[key] === 'boolean')) {
    throw new CommandError(`The architecture impact ${where} must explicitly give every classification flag as a boolean.`);
  }
  return flags as ArchitectureImpact['classification'];
}

function architectureOf(architecture: unknown, where: string): ArchitectureImpact['architecture'] {
  if (!isRecord(architecture) || typeof architecture.modelUpdated !== 'boolean' || !text(architecture.summary) || !texts(architecture.views) || !texts(architecture.evidence)) {
    throw new CommandError(`The architecture impact ${where} must give modelUpdated, a summary, checked views, and evidence.`);
  }
  return { modelUpdated: architecture.modelUpdated, summary: architecture.summary, views: architecture.views, evidence: architecture.evidence };
}

export function impactReasons(impact: ArchitectureImpact | undefined): Reason[] {
  if (impact === undefined) return [
    { tier: 'T1', key: 'impact.missing', fact: 'Architecture impact is not recorded for this candidate.' },
    { blocking: true, key: 'impact.missing', fact: 'Give --impact with the current candidate and merge base.' },
  ];
  return [
    ...architectureFlags.filter((key) => impact.classification[key]).map((key): Reason => ({ tier: 'T2', key: `impact.${key}`, fact: impact.architecture.summary })),
    ...teamFlags.filter((key) => impact.classification[key]).map((key): Reason => ({ tier: 'T1', key: `impact.${key}`, fact: impact.architecture.summary })),
    ...(impact.classification.uncertain ? [{ blocking: true as const, key: 'impact.uncertain', fact: 'Resolve the classification question and refresh the evidence.' }] : []),
  ];
}

function text(value: unknown): value is string { return typeof value === 'string' && value.trim() !== ''; }
function texts(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.every(text); }
