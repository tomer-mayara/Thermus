import { FREE_PLAN, TEAM_PLAN } from './calls.ts';
import type { ProbeStep } from './context.ts';
import { preflight } from './preflight.ts';
import type { StepId } from './step-ids.ts';
import { planChange, suspendResume } from './steps-lifecycle.ts';
import { create, internalAddress, secondImage } from './steps-service.ts';

export const preflightStep: ProbeStep = {
  name: 'Preflight',
  spec: 'Given the inputs, when the probe reads the workspace, its registry credentials, and its private services, then the credential exists and no other thermus-spike-* service exists.',
  run: preflight,
};

export const lifecycleSteps: readonly (ProbeStep & { readonly id: StepId })[] = [
  { id: 'create', name: 'Create', spec: `Given the inputs, when the probe creates an image-backed private service on ${FREE_PLAN} with every variable, then the first deploy reaches live.`, run: create },
  { id: 'internal-address', name: 'Internal address', spec: 'Given the live service, when the probe reads it, then the answer holds the internal address.', run: internalAddress },
  { id: 'image-2', name: 'Image 2', spec: 'Given the second digest, when the probe deploys it with imageUrl, then the deploy reaches live and the service reports the new image.', run: secondImage },
  { id: 'plan-change', name: 'Plan change', spec: `Given the live service, when the probe changes the plan to ${TEAM_PLAN} and back, then each answer shows the new plan.`, run: planChange },
  { id: 'suspend-resume', name: 'Suspend and resume', spec: 'Given the live service, when the probe suspends and resumes it, then the state changes each time and the resume reaches live.', run: suspendResume },
];
