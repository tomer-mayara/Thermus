import { parseArgs } from 'node:util';
import { FREE_PLAN, PRODUCTION_SERVICE_ID, SERVICE_PREFIX, TEAM_PLAN } from '../render-tenant-lifecycle/calls.ts';
import {
  credential, DEFAULT_REGION, imageRef, ownerId, PROBE_WORKSPACE_ID, region, REGIONS, required, reusedServiceId, UsageError,
  type ImageRef, type Region,
} from '../render-tenant-lifecycle/inputs.ts';

export const STEP_IDS = ['setup', 'calls-free', 'plan-team', 'calls-team', 'cleanup'] as const;
export type StepId = (typeof STEP_IDS)[number];
export const WORKLOADS = ['page9m', 'js', 'search'] as const;
export type Workload = (typeof WORKLOADS)[number];

export const TENANT_PREFIX = `${SERVICE_PREFIX}cap-`;
export const PAGES_PREFIX = `${SERVICE_PREFIX}pages-`;
const DEFAULT_PARALLELISM: readonly number[] = [1, 5, 10];
const MAX_PARALLELISM = 20;
const NEEDS_SETUP: readonly StepId[] = ['calls-free', 'plan-team', 'calls-team'];

export interface ProbeInputs {
  readonly owner: string;
  readonly registryCredential: string;
  readonly image: ImageRef;
  readonly region: Region;
  readonly dryRun: boolean;
  readonly preflightOnly: boolean;
  readonly serviceId?: string;
  readonly pagesId?: string;
  readonly keep: boolean;
  readonly steps: readonly StepId[];
  readonly parallelism: readonly number[];
  readonly workloads: readonly Workload[];
}

export const USAGE = [
  'Usage: node script/spike/capacity-probe.ts --owner <ownerId> --registry-credential <ID or name>',
  '         --image <repository@sha256:digest> [--region <region>] [--dry-run] [--preflight]',
  '         [--service-id <ID>] [--pages-id <ID>] [--steps <step,...>] [--keep]',
  '         [--parallelism <n,...>] [--workloads <workload,...>]',
  '',
  'Real mode reads RENDER_API_KEY, WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_AUTHKIT_ISSUER from the environment',
  'and never prints a key. The WorkOS values must be those of the Staging environment:',
  '  node ~/.config/thermus/with-workos-staging.cjs node --env-file=<main checkout>/.env.local script/spike/capacity-probe.ts ...',
  '  --dry-run      Print the calls that the same options send. No network call, no key.',
  '  --preflight    Make only the reads of the preflight. The Render client refuses each write.',
  `  --service-id   Use this live ${TENANT_PREFIX}* web service as the tenant service. No create.`,
  `  --pages-id     Use this live ${PAGES_PREFIX}* web service as the pages origin. No create.`,
  `  --steps        Run only these steps, in the fixed order: ${STEP_IDS.join(', ')}. The default is all of them.`,
  '                 calls-free, plan-team, and calls-team need setup. The cleanup always runs last; name it alone',
  '                 to run only the preflight and the cleanup.',
  '  --keep         Keep both services and the OAuth resource of the tenant service for a later run. The WorkOS',
  '                 fixtures of the run are always deleted.',
  `  --parallelism  The numbers of calls sent at the same time, from 1 to ${MAX_PARALLELISM}. The default is ${DEFAULT_PARALLELISM.join(',')}.`,
  `  --workloads    Any of ${WORKLOADS.join(', ')}, in this order. The default is all three.`,
  `The probe runs in the workspace Thermus AI, ${PROBE_WORKSPACE_ID}: the tenant service ${TENANT_PREFIX}<time> on`,
  `${FREE_PLAN}, then ${TEAM_PLAN}, and the pages origin ${PAGES_PREFIX}<time>. It touches no other service, and it`,
  `refuses the production service ${PRODUCTION_SERVICE_ID}.`,
  `Regions: ${REGIONS.join(', ')}. The default is ${DEFAULT_REGION}, the region of production.`,
].join('\n');

export function parseInputs(args: readonly string[]): ProbeInputs {
  const { values } = parseOptions(args);
  const steps = stepSelection(values.steps);
  const inputs: ProbeInputs = {
    owner: ownerId(required(values.owner, '--owner')),
    registryCredential: credential(required(values['registry-credential'], '--registry-credential')),
    image: imageRef(required(values.image, '--image'), '--image'),
    region: region(values.region ?? DEFAULT_REGION),
    dryRun: values['dry-run'] === true,
    ...reuseIds(values['service-id'], values['pages-id']),
    ...runLimits({ preflight: values.preflight === true, keep: values.keep === true, stepsGiven: values.steps !== undefined }, steps),
    steps,
    parallelism: parallelism(values.parallelism),
    workloads: workloads(values.workloads),
  };
  return Object.freeze(inputs);
}

function reuseIds(service: string | undefined, pages: string | undefined): Pick<ProbeInputs, 'serviceId' | 'pagesId'> {
  const serviceId = service === undefined ? undefined : reusedServiceId(service, '--service-id');
  const pagesId = pages === undefined ? undefined : reusedServiceId(pages, '--pages-id');
  if (serviceId !== undefined && serviceId === pagesId) throw new UsageError('--service-id and --pages-id must name two services.');
  return { serviceId, pagesId };
}

function runLimits(flags: { readonly preflight: boolean; readonly keep: boolean; readonly stepsGiven: boolean }, steps: readonly StepId[]): Pick<ProbeInputs, 'preflightOnly' | 'keep'> {
  if (flags.preflight && (flags.stepsGiven || flags.keep)) {
    throw new UsageError('--preflight makes only the reads of the preflight, so it takes no --steps and no --keep.');
  }
  if (flags.keep && steps.length === 1 && steps[0] === 'cleanup') throw new UsageError('--steps cleanup deletes the services, so it takes no --keep.');
  return { preflightOnly: flags.preflight, keep: flags.keep };
}

function namedList(value: string, option: string): readonly string[] {
  const named = value.split(',').map((item) => item.trim());
  if (named.some((item) => item === '')) throw new UsageError(`${option} has an empty item.`);
  if (new Set(named).size !== named.length) throw new UsageError(`${option} names an item more than one time.`);
  return named;
}

function stepSelection(value: string | undefined): readonly StepId[] {
  if (value === undefined) return STEP_IDS;
  const named = namedList(value, '--steps');
  const unknown = named.filter((item) => !STEP_IDS.some((id) => id === item));
  if (unknown.length > 0) throw new UsageError(`--steps names unknown steps: ${unknown.join(', ')}. The steps are ${STEP_IDS.join(', ')}.`);
  const steps = STEP_IDS.filter((id) => named.includes(id));
  const orphan = steps.filter((id) => NEEDS_SETUP.includes(id));
  if (orphan.length > 0 && !steps.includes('setup')) {
    throw new UsageError(`--steps names ${orphan.join(', ')}, so it must also name setup: setup checks the services and gets the token.`);
  }
  return steps.includes('cleanup') ? steps : [...steps, 'cleanup'];
}

function parallelism(value: string | undefined): readonly number[] {
  if (value === undefined) return DEFAULT_PARALLELISM;
  const named = namedList(value, '--parallelism');
  const numbers = named.map(Number);
  if (named.some((item) => !/^\d{1,2}$/.test(item)) || numbers.some((count) => count < 1 || count > MAX_PARALLELISM)) {
    throw new UsageError(`--parallelism must list whole numbers from 1 to ${MAX_PARALLELISM}.`);
  }
  return [...numbers].sort((a, b) => a - b);
}

function workloads(value: string | undefined): readonly Workload[] {
  if (value === undefined) return WORKLOADS;
  const named = namedList(value, '--workloads');
  const unknown = named.filter((item) => !WORKLOADS.some((workload) => workload === item));
  if (unknown.length > 0) throw new UsageError(`--workloads names unknown workloads: ${unknown.join(', ')}. The workloads are ${WORKLOADS.join(', ')}.`);
  return WORKLOADS.filter((workload) => named.includes(workload));
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
      'service-id': { type: 'string' },
      'pages-id': { type: 'string' },
      steps: { type: 'string' },
      keep: { type: 'boolean' },
      parallelism: { type: 'string' },
      workloads: { type: 'string' },
    },
  });
}
