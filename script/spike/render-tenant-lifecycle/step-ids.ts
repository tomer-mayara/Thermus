const STEP_IDS = ['create', 'internal-address', 'image-2', 'plan-change', 'suspend-resume'] as const;
export type StepId = (typeof STEP_IDS)[number];

type Selection = { readonly steps: readonly StepId[] } | { readonly problem: string };

function isStepId(value: string): value is StepId {
  return STEP_IDS.some((id) => id === value);
}

export function stepSelection(value: string | undefined, reuse: boolean): Selection {
  const later = STEP_IDS.filter((id) => id !== 'create');
  if (value === undefined) return { steps: reuse ? later : STEP_IDS };
  const named = value.split(',').map((item) => item.trim());
  const unknown = named.filter((item) => !isStepId(item));
  if (unknown.length > 0) return { problem: `--steps names unknown steps: ${unknown.join(', ')}. The steps are ${STEP_IDS.join(', ')}.` };
  if (new Set(named).size !== named.length) return { problem: '--steps names a step more than one time.' };
  const steps = STEP_IDS.filter((id) => named.includes(id));
  if (reuse && steps.includes('create')) return { problem: '--service-id uses a service that exists, so --steps cannot name create.' };
  if (!reuse && !steps.includes('create')) return { problem: 'Without --service-id, --steps must name create: the other steps need a service.' };
  return { steps };
}
