import { parseArgs } from 'node:util';
import { FREE_PLAN, PRODUCTION_SERVICE_ID, SERVICE_PREFIX } from '../render-tenant-lifecycle/calls.ts';
import {
  credential, DEFAULT_REGION, imageRef, ownerId, PROBE_WORKSPACE_ID, region, REGIONS, required, reusedServiceId, UsageError,
  type ImageRef, type Region,
} from '../render-tenant-lifecycle/inputs.ts';

const STEP_IDS = ['private', 'web', 'job', 'control-plane', 'public-check'] as const;
export type StepId = (typeof STEP_IDS)[number];

export const WEB_PREFIX = `${SERVICE_PREFIX}web-`;

export interface ProbeInputs {
  readonly owner: string;
  readonly registryCredential: string;
  readonly image: ImageRef;
  readonly region: Region;
  readonly dryRun: boolean;
  readonly preflightOnly: boolean;
  readonly privateServiceId?: string;
  readonly webServiceId?: string;
  readonly keep: boolean;
  readonly steps: readonly StepId[];
}

export const USAGE = [
  'Usage: node script/spike/private-network-probe.ts --owner <ownerId> --registry-credential <ID or name>',
  '         --image <repository@sha256:digest> [--region <region>] [--dry-run] [--preflight]',
  '         [--private-service-id <ID>] [--web-service-id <ID>] [--steps <step,...>] [--keep]',
  '',
  'Real mode reads RENDER_API_KEY from the environment and never prints it. Give it the git-ignored .env.local',
  'of the main checkout: node --env-file=<main checkout>/.env.local script/spike/private-network-probe.ts ...',
  '  --dry-run             Print the calls that the same options send. No network call, no key.',
  '  --preflight           Make only the reads of the preflight. The client refuses each write.',
  `  --private-service-id  Use this live ${SERVICE_PREFIX}* private service of the owner. No create.`,
  `  --web-service-id      Use this live ${WEB_PREFIX}* web service of the owner. No create.`,
  `  --steps               Run only these steps, in the fixed order: ${STEP_IDS.join(', ')}. The default is all`,
  '                        of them. job and control-plane need private and web; public-check needs private.',
  '                        control-plane (SO-03) runs the job on the private service, the tenant, and requests',
  '                        /healthz of the web service, the control plane, at its slug on port 8080 and 10000.',
  '  --keep                Keep both services when every step passed. After a failure, the cleanup deletes them.',
  `The probe runs in the workspace Thermus AI, ${PROBE_WORKSPACE_ID}, with a private service ${SERVICE_PREFIX}<time>`,
  `and a web service ${WEB_PREFIX}<time>, both from the image and on ${FREE_PLAN}. It touches no other service,`,
  `and it refuses the production service ${PRODUCTION_SERVICE_ID}.`,
  `Regions: ${REGIONS.join(', ')}. The default is ${DEFAULT_REGION}, the region of production.`,
].join('\n');

export function parseInputs(args: readonly string[]): ProbeInputs {
  const { values } = parseOptions(args);
  const privateServiceId = values['private-service-id'] === undefined ? undefined : reusedServiceId(values['private-service-id'], '--private-service-id');
  const webServiceId = values['web-service-id'] === undefined ? undefined : reusedServiceId(values['web-service-id'], '--web-service-id');
  if (privateServiceId !== undefined && privateServiceId === webServiceId) throw new UsageError('--private-service-id and --web-service-id must name two services.');
  const preflightOnly = values.preflight === true;
  if (preflightOnly && (values.steps !== undefined || values.keep === true)) {
    throw new UsageError('--preflight makes only the reads of the preflight, so it takes no --steps and no --keep.');
  }
  const inputs: ProbeInputs = {
    owner: ownerId(required(values.owner, '--owner')),
    registryCredential: credential(required(values['registry-credential'], '--registry-credential')),
    image: imageRef(required(values.image, '--image'), '--image'),
    region: region(values.region ?? DEFAULT_REGION),
    dryRun: values['dry-run'] === true,
    preflightOnly,
    privateServiceId,
    webServiceId,
    keep: values.keep === true,
    steps: stepSelection(values.steps),
  };
  return Object.freeze(inputs);
}

const NEEDED_STEPS: Readonly<Partial<Record<StepId, { readonly steps: readonly StepId[]; readonly reason?: string }>>> = {
  job: { steps: ['private', 'web'], reason: 'the job runs on the web service and requests the private service' },
  'control-plane': { steps: ['private', 'web'], reason: 'the job runs on the private service and requests the web service' },
  'public-check': { steps: ['private'] },
};

function isStepId(value: string): value is StepId {
  return STEP_IDS.some((id) => id === value);
}

function stepSelection(value: string | undefined): readonly StepId[] {
  if (value === undefined) return STEP_IDS;
  const named = value.split(',').map((item) => item.trim());
  const unknown = named.filter((item) => !isStepId(item));
  if (unknown.length > 0) throw new UsageError(`--steps names unknown steps: ${unknown.join(', ')}. The steps are ${STEP_IDS.join(', ')}.`);
  if (new Set(named).size !== named.length) throw new UsageError('--steps names a step more than one time.');
  const steps = STEP_IDS.filter((id) => named.includes(id));
  for (const step of steps) requireNeededSteps(step, steps);
  return steps;
}

function requireNeededSteps(step: StepId, steps: readonly StepId[]): void {
  const needed = NEEDED_STEPS[step];
  if (needed === undefined || needed.steps.every((id) => steps.includes(id))) return;
  const reason = needed.reason === undefined ? '' : `: ${needed.reason}`;
  throw new UsageError(`--steps names ${step}, so it must also name ${needed.steps.join(' and ')}${reason}.`);
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
      owner: { type: 'string' },
      'registry-credential': { type: 'string' },
      image: { type: 'string' },
      region: { type: 'string' },
      'dry-run': { type: 'boolean' },
      preflight: { type: 'boolean' },
      'private-service-id': { type: 'string' },
      'web-service-id': { type: 'string' },
      steps: { type: 'string' },
      keep: { type: 'boolean' },
    },
  });
}
