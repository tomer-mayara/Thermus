import { tiers, tierNames, type Reason, type Tier } from './types.ts';

export function tierOf(reasons: readonly Reason[]): Tier {
  return tiers.find((tier) => reasons.some((reason) => reason.tier === tier)) ?? 'T0';
}

export function orderedReasons(reasons: readonly Reason[]): Reason[] {
  return [...reasons.filter((reason) => reason.blocking), ...tiers.flatMap((tier) => reasons.filter((reason) => !reason.blocking && reason.tier === tier))];
}

export function reasonName(reason: Reason): string {
  return reason.blocking ? 'blocked' : tierNames[reason.tier ?? 'T0'];
}

// The command does not know the pull request number. Labels carry the same names as the report.
export function labelCommand(tier: Tier, repository: string | undefined): string {
  return [
    'gh pr edit <n>',
    ...(repository === undefined ? [] : [`--repo ${repository}`]),
    `--add-label '${tierNames[tier]}'`,
    ...tiers.filter((other) => other !== tier).map((other) => `--remove-label '${tierNames[other]}'`),
  ].join(' ');
}
