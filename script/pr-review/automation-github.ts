import { combineAssessments, escalationFromEvents, externalAssessment, type CheckRun, type LabelEvent } from './automation-evidence.ts';
import { inspectCandidate, trustedCommit } from './automation-git.ts';
import type { Assessment, MergeEvidence, MergePort, Review } from './automation-model.ts';
import { isControllerCheck, protectionBlockers } from './automation-protection.ts';
import { validationSelection } from './automation-selection.ts';

interface PullRequest {
  readonly number: number;
  readonly state: string;
  readonly draft: boolean;
  readonly mergeable: boolean | null;
  readonly body: string | null;
  readonly user: { readonly login: string };
  readonly labels: readonly { readonly name: string }[];
  readonly head: { readonly sha: string; readonly repo: { readonly full_name: string } | null };
  readonly base: { readonly ref: string };
}

interface WorkflowRun {
  readonly id: number;
  readonly head_sha: string;
  readonly path: string;
  readonly event: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly pull_requests: readonly { readonly number: number }[];
}

interface ApiReview {
  readonly user: { readonly login: string; readonly type: string };
  readonly state: string;
  readonly commit_id: string;
  readonly submitted_at: string;
}

interface ApiOptions {
  readonly repository: string;
  readonly token: string;
  readonly root: string;
  readonly enabled: boolean;
  readonly team: readonly string[];
  readonly architects: readonly string[];
  readonly externalAppId: number;
  readonly runId: string;
  readonly protectionToken?: string;
}

export class GitHubMergePort implements MergePort {
  private readonly options: ApiOptions;
  private readonly number: number;

  constructor(options: ApiOptions, number: number) {
    this.options = options;
    this.number = number;
  }

  async inspect(): Promise<MergeEvidence> {
    const pr = await this.get<PullRequest>(`pulls/${this.number}`);
    const repo = await this.get<{ readonly default_branch: string }>('');
    const branch = await this.get<{ readonly commit: { readonly sha: string }; readonly protected: boolean }>(`branches/${encodeURIComponent(repo.default_branch)}`);
    const base = branch.commit.sha;
    if (trustedCommit(this.options.root) !== base) throw new Error('The trusted checkout is stale. Run the gate from the current default branch.');
    if (pr.head.repo?.full_name !== this.options.repository) throw new Error('Fork candidates require manual review and merge.');
    const inspected = inspectCandidate(this.options.root, { head: pr.head.sha, base }, this.options.token);
    const [checks, statuses, reviews, validation, events] = await Promise.all([
      this.pages<CheckRun>(`commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs'),
      this.pages<{ readonly context: string; readonly state: string }>(`commits/${pr.head.sha}/status`, 'statuses'),
      this.pages<ApiReview>(`pulls/${this.number}/reviews`),
      this.validationOf(pr),
      this.pages<LabelEvent>(`issues/${this.number}/events`),
    ]);
    const assessed = this.assessed(inspected, checks);
    const externalBlockers = [...assessed.blockers, ...await this.branchBlockers(repo.default_branch, branch.protected, checks)];
    let assessment = assessed.assessment;
    const escalation = escalationFromEvents(events);
    if (escalation.tier > assessment.tier) assessment = { ...assessment, tier: escalation.tier };
    return {
      enabled: this.options.enabled, head: pr.head.sha, base, paths: inspected.paths, author: pr.user.login, draft: pr.draft,
      state: pr.state, mergeable: pr.mergeable === true, held: pr.labels.some((label) => label.name === 'hold'), defaultBranch: pr.base.ref === repo.default_branch,
      assessment, validation: { trusted: validation.trusted && !inspected.changedValidation, passed: validation.passed }, checks: this.checkStates(checks, statuses),
      reviews: reviews.map(reviewOf), team: this.options.team, architects: this.options.architects, reviewAfter: escalation.after, externalBlockers,
    };
  }

  async merge(expectedHead: string): Promise<void> {
    const result = await this.request<{ readonly merged: boolean }>(`pulls/${this.number}/merge`, { method: 'PUT', body: { sha: expectedHead, merge_method: 'squash' } });
    if (!result.merged) throw new Error('GitHub did not merge the expected candidate.');
  }

  private assessed(inspected: ReturnType<typeof inspectCandidate>, checks: readonly CheckRun[]): { readonly assessment: Assessment; readonly blockers: readonly string[] } {
    const local = inspected.assessment;
    if (!validationSelection(inspected.paths).external && !local.blockers.some((entry) => entry.key.startsWith('evidence.'))) return { assessment: local, blockers: [] };
    try {
      const external = externalAssessment(checks, { appId: this.options.externalAppId, head: local.candidate, baseTip: local.mergeBase });
      return { assessment: combineAssessments(local, external), blockers: [] };
    } catch (error) { return { assessment: local, blockers: [String(error)] }; }
  }

  private async branchBlockers(name: string, protectedBranch: boolean, checks: readonly CheckRun[]): Promise<readonly string[]> {
    if (!protectedBranch) return ['The default branch needs protection before automatic merging.'];
    const protection = await this.request<Parameters<typeof protectionBlockers>[0]>(`branches/${encodeURIComponent(name)}/protection`, { token: this.options.protectionToken });
    const appId = checks.find((check) => check.name === 'candidate-validation' && check.app?.slug === 'github-actions')?.app?.id ?? 0;
    return protectionBlockers(protection, appId);
  }

  private checkStates(checks: readonly CheckRun[], statuses: readonly { readonly context: string; readonly state: string }[]): MergeEvidence['checks'] {
    return [
      ...checks.filter((check) => !isControllerCheck(check, this.options.runId, this.options.repository)).map((check) => ({ name: check.name, status: check.status, conclusion: check.conclusion })),
      ...statuses.map((status) => ({ name: status.context, status: status.state === 'pending' ? 'pending' : 'completed', conclusion: status.state === 'success' ? 'success' : status.state })),
    ];
  }

  private async validationOf(pr: PullRequest): Promise<{ readonly trusted: boolean; readonly passed: boolean }> {
    const runs = await this.pages<WorkflowRun>(`actions/workflows/pr-validation.yml/runs?head_sha=${pr.head.sha}&event=pull_request`, 'workflow_runs');
    const run = runs.find((entry) => entry.head_sha === pr.head.sha && entry.path === '.github/workflows/pr-validation.yml' && entry.event === 'pull_request' && entry.pull_requests.some((item) => item.number === this.number));
    if (!run) return { trusted: false, passed: false };
    const jobs = await this.pages<{ readonly status: string; readonly conclusion: string | null }>(`actions/runs/${run.id}/jobs`, 'jobs');
    return { trusted: true, passed: run.status === 'completed' && run.conclusion === 'success' && jobs.length > 0 && jobs.every((job) => job.status === 'completed' && job.conclusion === 'success') };
  }

  private get<T>(path: string): Promise<T> { return this.request<T>(path); }

  private async pages<T>(path: string, key?: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const value = await this.get<unknown>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const items = key ? (value as Record<string, unknown>)[key] : value;
      if (!Array.isArray(items)) throw new Error('GitHub returned an invalid list.');
      result.push(...items as T[]);
      if (items.length < 100) return result;
    }
    throw new Error('GitHub results exceeded the complete-evidence limit.');
  }

  private async request<T>(path: string, options: { readonly method?: string; readonly body?: unknown; readonly token?: string } = {}): Promise<T> {
    const { method = 'GET', body, token = this.options.token } = options;
    const response = await fetch(`https://api.github.com/repos/${this.options.repository}${path ? `/${path}` : ''}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} returned ${response.status}.`);
    return await response.json() as T;
  }
}

function reviewOf(review: ApiReview): Review {
  return { login: review.user.login, type: review.user.type, state: review.state, head: review.commit_id, submittedAt: review.submitted_at };
}

export async function openPullRequests(repository: string, token: string): Promise<number[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/pulls?state=open&per_page=100`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`GitHub could not list pull requests: ${response.status}.`);
  const pulls = await response.json() as PullRequest[];
  if (pulls.length === 100) throw new Error('More than 99 open pull requests: run the gate with an explicit number.');
  return pulls.map((pr) => pr.number);
}
