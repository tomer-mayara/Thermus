import type { FleetRow } from './tenant-fleet-store.ts';
import type { TenantState } from './tenant-registry-store.ts';

// Plan section 8, in USD a month and approximate: a running free tenant about 7, a team tenant about 25.
const MONTHLY_USD = { free: 7, team: 25 } as const;
// A service runs, and its plan costs, in these states. A suspended service costs nothing, and a requested, failed, or
// deleted row has no running service.
const RUNNING: ReadonlySet<TenantState> = new Set(['creating', 'deploying', 'live']);
const STATE_ORDER: readonly TenantState[] = ['requested', 'creating', 'deploying', 'live', 'suspended', 'failed', 'deleted'];

/** The rows of one state and one plan, and their monthly cost in USD. */
export interface StatePlanCount {
  readonly state: TenantState;
  readonly plan: string | null;
  readonly count: number;
  readonly monthlyUsd: number;
}

/**
 * The rows that are not deleted, by state and plan, with their monthly cost, in the order of the states and then of
 * the plans. freePlan is the plan of a free tenant (TENANT_PLAN_FREE). Each other plan counts as the team plan of D-12,
 * because Slice 2 has no setting for it yet.
 */
export function costByStateAndPlan(rows: readonly FleetRow[], freePlan: string): readonly StatePlanCount[] {
  const groups = new Map<string, { readonly state: TenantState; readonly plan: string | null; count: number }>();
  for (const { state, plan } of rows) {
    if (state === 'deleted') continue;
    const key = JSON.stringify([state, plan]);
    const group = groups.get(key) ?? { state, plan, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort(byStateThenPlan).map(({ state, plan, count }) => ({ state, plan, count, monthlyUsd: count * monthlyUsdOf(state, plan, freePlan) }));
}

function monthlyUsdOf(state: TenantState, plan: string | null, freePlan: string): number {
  if (!RUNNING.has(state) || plan === null) return 0;
  return plan === freePlan ? MONTHLY_USD.free : MONTHLY_USD.team;
}

// A row without a plan comes first within its state.
function byStateThenPlan(first: Pick<StatePlanCount, 'state' | 'plan'>, second: Pick<StatePlanCount, 'state' | 'plan'>): number {
  const byState = STATE_ORDER.indexOf(first.state) - STATE_ORDER.indexOf(second.state);
  return byState !== 0 ? byState : (first.plan ?? '').localeCompare(second.plan ?? '');
}
