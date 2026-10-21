import type { MergeDecision, MergeEvidence, MergePort, Review } from './automation-model.ts';

const names = { T0: 'T0 Auto merge', T1: 'T1 Team review', T2: 'T2 Need architect' } as const;

function mergeDecision(evidence: MergeEvidence): MergeDecision {
  const blockers = [...candidateBlockers(evidence), ...reviewBlockers(evidence), ...(evidence.externalBlockers ?? [])];
  return { tierName: names[evidence.assessment.tier], eligibility: blockers.length === 0 ? 'eligible' : 'blocked', blockers };
}

// Re-read the candidate and its authority immediately before the SHA-conditional write.
export async function mergeReviewedCandidate(port: MergePort): Promise<MergeDecision> {
  const first = await port.inspect();
  const initial = mergeDecision(first);
  if (initial.eligibility === 'blocked') return initial;
  const current = await port.inspect();
  const final = mergeDecision(current);
  if (first.head !== current.head || first.base !== current.base || JSON.stringify(first.assessment) !== JSON.stringify(current.assessment)) {
    return { ...final, eligibility: 'blocked', blockers: [...final.blockers, 'The candidate, its base, or its assessment changed before merge.'] };
  }
  if (final.eligibility === 'eligible') await port.merge(current.head);
  return final;
}

function candidateBlockers(evidence: MergeEvidence): string[] {
  const { assessment } = evidence;
  const blockers = [...stateBlockers(evidence), ...assessment.blockers.map(({ key, fact }) => `${key}: ${fact}`)];
  if (assessment.candidate !== evidence.head || assessment.mergeBase !== evidence.base) blockers.push('The assessment is not of the current head and base.');
  if (assessment.eligibility !== 'eligible') blockers.push('The local assessment is blocked.');
  if (!evidence.validation.trusted || !evidence.validation.passed) blockers.push('The required validation workflow has no trusted current success.');
  return [...blockers, ...checkBlockers(evidence.checks)];
}

function checkBlockers(checks: MergeEvidence['checks']): string[] {
  const blockers: string[] = [];
  if (checks.length === 0) blockers.push('No candidate checks are available.');
  for (const check of checks) {
    if (check.status !== 'completed' || check.conclusion !== 'success') blockers.push(`${check.name}: ${check.status}/${check.conclusion ?? 'missing result'}`);
  }
  return blockers;
}

function stateBlockers(evidence: MergeEvidence): string[] {
  const blockers: string[] = [];
  if (!evidence.enabled) blockers.push('Automatic merging is not enabled.');
  if (evidence.draft || evidence.state !== 'open') blockers.push('The pull request must be open and Ready.');
  if (!evidence.defaultBranch) blockers.push('The pull request must target the default branch.');
  if (!evidence.mergeable) blockers.push('GitHub has not confirmed that the candidate can merge.');
  if (evidence.held) blockers.push('The pull request has a hold.');
  if (evidence.paths.some((path) => path.startsWith('architecture/decisions/'))) blockers.push('Decision record changes need manual owner merge.');
  return blockers;
}

function reviewBlockers(evidence: MergeEvidence): string[] {
  const independent = (review: Review) => review.type === 'User' && review.login.toLowerCase() !== evidence.author.toLowerCase();
  const reviews = latestReviews(evidence.reviews).filter(independent);
  const blockers = reviews.filter((review) => review.state === 'CHANGES_REQUESTED').map((review) => `${review.login} requested changes.`);
  if (evidence.assessment.tier === 'T0') return blockers;
  const permitted = new Set((evidence.assessment.tier === 'T2' ? evidence.architects : [...evidence.team, ...evidence.architects]).map((login) => login.toLowerCase()));
  const approved = reviews.some((review) => review.state === 'APPROVED' && review.head === evidence.head && permitted.has(review.login.toLowerCase()) && review.submittedAt >= (evidence.reviewAfter ?? ''));
  if (!approved) blockers.push(`${names[evidence.assessment.tier]} needs an independent current-head human approval.`);
  return blockers;
}

function latestReviews(reviews: readonly Review[]): Review[] {
  const latest = new Map<string, Review>();
  for (const review of [...reviews].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    // A comment does not dismiss an approval or a request for changes.
    if (review.state !== 'COMMENTED' && review.state !== 'PENDING') latest.set(review.login.toLowerCase(), review);
  }
  return [...latest.values()];
}
