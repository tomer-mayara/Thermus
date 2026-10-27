import { FREE_PLAN, TEAM_PLAN } from '../render-tenant-lifecycle/calls.ts';
import type { ProbeStep } from './context.ts';
import type { StepId } from './inputs.ts';
import { preflight } from './preflight.ts';
import { planTeam, setup } from './setup.ts';
import { callsOn } from './windows.ts';

const CALLS_SPEC = 'when the probe sends 1, 5, and 10 calls at the same time for the 9 MiB page, the JavaScript page, and the search, '
  + 'then each call has its outcome and duration, and each window has its memory peak, memory limit, CPU peak, instance count, kills, and restart time';

export const preflightStep: ProbeStep = {
  name: 'Preflight',
  spec: 'Given the inputs, when the probe reads the workspace, its registry credentials, its services of every type, and the WorkOS Staging resources, then the credential exists, no other thermus-spike-* service exists, and the live gate URI is listed.',
  run: preflight,
};

export const probeSteps: readonly (ProbeStep & { readonly id: Exclude<StepId, 'cleanup'> })[] = [
  {
    id: 'setup', name: 'Setup', run: setup,
    spec: `Given the inputs, when the probe makes or reuses the pages origin and the tenant service on ${FREE_PLAN}, registers the tenant resource, and gets a Connect token, then both pages answer with their sizes and markers, /healthz answers 200 with ok, and tools/list names both tools.`,
  },
  { id: 'calls-free', name: `Calls on ${FREE_PLAN}`, run: (context) => callsOn(context, FREE_PLAN), spec: `Given the tenant service on ${FREE_PLAN}, ${CALLS_SPEC}.` },
  {
    id: 'plan-team', name: `Plan ${TEAM_PLAN}`, run: planTeam,
    spec: `Given the tenant service, when the probe updates the plan to ${TEAM_PLAN} and deploys, then the service shows ${TEAM_PLAN}, a new instance replaced the old one, and /healthz answers 200 with ok.`,
  },
  { id: 'calls-team', name: `Calls on ${TEAM_PLAN}`, run: (context) => callsOn(context, TEAM_PLAN), spec: `Given the tenant service on ${TEAM_PLAN}, ${CALLS_SPEC}.` },
];
