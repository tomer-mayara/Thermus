import { parseArgs } from 'node:util';
import { UsageError } from '../render-tenant-lifecycle/inputs.ts';

const WORK_STEP_IDS = ['seat-sync', 'checkout', 'webhook', 'test-clock'] as const;
export type WorkStepId = (typeof WORK_STEP_IDS)[number];
const SWEEP_STEP = 'cleanup';

export interface ProbeInputs {
  // The work steps of this run, in the fixed order. The cleanup of the run always follows them.
  readonly steps: readonly WorkStepId[];
  // --steps cleanup: delete the objects of earlier runs, and run no other step.
  readonly sweep: boolean;
  readonly workosOnly: boolean;
  readonly dryRun: boolean;
  readonly keep: boolean;
}

// The shared runner of the probes gives exit code 2 for this error class.
export { UsageError };

export const USAGE = [
  'Usage: node script/spike/stripe-seat-sync-probe.ts [--steps <step,...>] [--workos-only] [--keep] [--dry-run]',
  '',
  'Run it from the repository root through the WorkOS Staging launcher, with the git-ignored .env.local of the main',
  'checkout: node ~/.config/thermus/with-workos-staging.cjs node --env-file=<main checkout>/.env.local \\',
  '  script/spike/stripe-seat-sync-probe.ts ...',
  'The launcher gives WORKOS_API_KEY (sk_test_) of the WorkOS Staging environment. The env file gives',
  'STRIPE_RESTRICTED_KEY, a restricted key of Stripe test mode (rk_test_), and STRIPE_PRICE_ID. No output holds a',
  'key or a signing secret.',
  `  --steps        Run only these steps, in the fixed order: ${WORK_STEP_IDS.join(', ')}. The default is all of`,
  `                 them. --steps ${SWEEP_STEP} runs alone: it deletes the objects of earlier runs and checks that none`,
  '                 remain. The end of every run deletes the objects of that run.',
  '  --workos-only  Run only the WorkOS part of seat-sync, with a fake stripe_customer_id. No Stripe call, no',
  '                 Stripe key.',
  '  --keep         Keep the objects of this run when every step passed. After a failure, the cleanup deletes them.',
  '  --dry-run      Print the planned calls. No network call, and no key is needed.',
  'The webhook step needs the Stripe CLI, signed in: it reads the signing secret with stripe listen --print-secret.',
  'The checkout step waits up to 15 minutes for the operator to pay in a browser with a Stripe test card.',
  'Exit codes: 0 when each step and the cleanup passed, 1 when a step or the cleanup failed, 2 for a usage error.',
].join('\n');

function isWorkStep(value: string): value is WorkStepId {
  return WORK_STEP_IDS.some((id) => id === value);
}

function namedSteps(value: string): readonly string[] {
  const named = value.split(',').map((item) => item.trim());
  const unknown = named.filter((item) => item !== SWEEP_STEP && !isWorkStep(item));
  if (unknown.length > 0) throw new UsageError(`--steps names unknown steps: ${unknown.join(', ')}. The steps are ${[...WORK_STEP_IDS, SWEEP_STEP].join(', ')}.`);
  if (new Set(named).size !== named.length) throw new UsageError('--steps names a step more than one time.');
  if (named.includes(SWEEP_STEP) && named.length > 1) throw new UsageError(`--steps ${SWEEP_STEP} runs alone: it deletes the objects of earlier runs.`);
  return named;
}

function parseOptions(args: readonly string[]): ReturnType<typeof parseProbeArgs> {
  try {
    return parseProbeArgs(args);
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

function parseProbeArgs(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    strict: true,
    allowPositionals: false,
    options: {
      steps: { type: 'string' },
      'workos-only': { type: 'boolean' },
      keep: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
  });
}

export function parseInputs(args: readonly string[]): ProbeInputs {
  const { values } = parseOptions(args);
  const workosOnly = values['workos-only'] === true;
  if (workosOnly && values.steps !== undefined) throw new UsageError('--workos-only runs only the WorkOS part of seat-sync, so it takes no --steps.');
  const named = values.steps === undefined ? WORK_STEP_IDS : namedSteps(values.steps);
  const sweep = named.includes(SWEEP_STEP);
  if (sweep && values.keep === true) throw new UsageError(`--steps ${SWEEP_STEP} deletes objects, so it takes no --keep.`);
  const steps: readonly WorkStepId[] = workosOnly ? ['seat-sync'] : WORK_STEP_IDS.filter((id) => named.includes(id));
  return Object.freeze({ steps, sweep, workosOnly, dryRun: values['dry-run'] === true, keep: values.keep === true });
}

// True when a step of this run calls Stripe: every work step, except seat-sync with --workos-only.
export function usesStripe(inputs: ProbeInputs): boolean {
  return !inputs.workosOnly && inputs.steps.length > 0;
}

// True when a step of this run calls WorkOS: seat-sync, and the sweep of earlier runs.
export function usesWorkOS(inputs: ProbeInputs): boolean {
  return inputs.sweep || inputs.steps.includes('seat-sync');
}
