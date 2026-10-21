import type { Assessment, ReviewTier } from './automation-model.ts';

export interface CheckRun {
  readonly name: string;
  readonly head_sha: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly details_url?: string | null;
  readonly app: { readonly id: number; readonly slug: string } | null;
  readonly output: { readonly text: string | null };
}

const missingMetrics = new Set(['evidence.snapshots', 'evidence.crap', 'evidence.process']);

export interface LabelEvent {
  readonly event: string;
  readonly label?: { readonly name: string };
  readonly created_at: string;
}

export function escalationFromEvents(events: readonly LabelEvent[]): { readonly tier: ReviewTier; readonly after: string } {
  let tier: ReviewTier = 'T0';
  let after = '';
  for (const event of events) {
    const raised = raisedTier(event);
    if (!raised || raised < tier) continue;
    if (raised > tier) after = '';
    tier = raised;
    if (event.created_at > after) after = event.created_at;
  }
  return { tier, after };
}

function raisedTier(event: LabelEvent): ReviewTier | undefined {
  if (event.event !== 'labeled') return undefined;
  if (event.label?.name === 'T2 Need architect') return 'T2';
  if (event.label?.name === 'T1 Team review') return 'T1';
  return undefined;
}

export function combineAssessments(local: Assessment, external: Assessment): Assessment {
  if (external.candidate !== local.candidate || external.mergeBase !== local.mergeBase) throw new Error('The external assessment is of another candidate or base.');
  if (external.tier < local.tier) throw new Error('The external assessment cannot lower the trusted static tier.');
  const blockers = [...local.blockers.filter((blocker) => !missingMetrics.has(blocker.key)), ...external.blockers];
  return { ...local, tier: external.tier, blockers, eligibility: blockers.length === 0 && external.eligibility === 'eligible' ? 'eligible' : 'blocked' };
}

export function externalAssessment(checks: readonly CheckRun[], authority: { readonly appId: number; readonly head: string; readonly baseTip: string }): Assessment {
  const { appId, head, baseTip } = authority;
  const check = checks.find((entry) => entry.name === 'thermus/required-gates' && entry.app?.id === appId && entry.app.slug !== 'github-actions' && entry.head_sha === head && entry.status === 'completed' && entry.conclusion === 'success');
  if (!Number.isSafeInteger(appId) || appId <= 0 || !check?.output.text) throw new Error('No trusted complete required-gates assessment is available.');
  const report: unknown = JSON.parse(check.output.text);
  if (!isRecord(report) || report.version !== 1 || report.baseTip !== baseTip) throw new Error('The trusted required-gates report is not of the current base.');
  const assessment = assessmentOf(report.assessment);
  if (assessment.candidate !== head || assessment.mergeBase !== baseTip) throw new Error('The trusted required-gates report is not of the current candidate.');
  return assessment;
}

export function assessmentOf(value: unknown): Assessment {
  if (!isRecord(value) || !isSha(value.candidate) || !isSha(value.mergeBase) || !['T0', 'T1', 'T2'].includes(String(value.tier)) || !['eligible', 'blocked'].includes(String(value.eligibility)) || !Array.isArray(value.blockers)) throw new Error('Invalid assessment.');
  if (!value.blockers.every((blocker: unknown) => isRecord(blocker) && typeof blocker.key === 'string' && typeof blocker.fact === 'string')) throw new Error('Invalid assessment blockers.');
  if (value.eligibility === 'eligible' && value.blockers.length > 0) throw new Error('An eligible assessment cannot contain blockers.');
  return value as unknown as Assessment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{40}$/.test(value);
}
