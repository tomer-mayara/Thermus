interface Protection {
  readonly required_status_checks?: { readonly strict?: boolean; readonly checks?: readonly { readonly context: string; readonly app_id: number | null }[] };
  readonly enforce_admins?: { readonly enabled?: boolean };
  readonly allow_force_pushes?: { readonly enabled?: boolean };
  readonly allow_deletions?: { readonly enabled?: boolean };
  readonly required_pull_request_reviews?: { readonly bypass_pull_request_allowances?: { readonly users?: readonly unknown[]; readonly teams?: readonly unknown[]; readonly apps?: readonly unknown[] } };
}

export function protectionBlockers(protection: Protection, validationAppId: number): string[] {
  const blockers = statusProtection(protection, validationAppId);
  if (protection.enforce_admins?.enabled !== true) blockers.push('Branch protection must apply to administrators.');
  if (protection.allow_force_pushes?.enabled !== false || protection.allow_deletions?.enabled !== false) blockers.push('Protected branch force pushes and deletion must be disabled.');
  const bypass = protection.required_pull_request_reviews?.bypass_pull_request_allowances;
  if (bypass && Object.values(bypass).some((entries) => entries.length > 0)) blockers.push('Branch protection must have no review bypass actors.');
  return blockers;
}

function statusProtection(protection: Protection, validationAppId: number): string[] {
  const blockers: string[] = [];
  if (protection.required_status_checks?.strict !== true) blockers.push('Branch protection must require up-to-date checks to close the base-advance race.');
  const required = protection.required_status_checks?.checks ?? [];
  if (validationAppId <= 0 || !required.some((check) => check.context === 'candidate-validation' && check.app_id === validationAppId)) blockers.push('Branch protection must require candidate-validation from the trusted GitHub Actions App.');
  return blockers;
}

export function isControllerCheck(check: { readonly name: string; readonly app: { readonly slug: string } | null; readonly details_url?: string | null }, runId: string, repository: string): boolean {
  if (check.name !== 'merge-gate' || check.app?.slug !== 'github-actions' || !/^\d+$/.test(runId)) return false;
  try {
    const url = new URL(check.details_url ?? '');
    return url.origin === 'https://github.com' && url.pathname.startsWith(`/${repository}/actions/runs/${runId}/job/`) && /^\d+$/.test(url.pathname.split('/').at(-1) ?? '');
  } catch { return false; }
}
