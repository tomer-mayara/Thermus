import { parseArgs } from 'node:util';
import { PRODUCTION_SERVICE_ID, SERVICE_PREFIX } from './calls.ts';
import { stepSelection, type StepId } from './step-ids.ts';

type Environment = Readonly<Record<string, string | undefined>>;

// The other probes import the value checks below, so that each probe applies the same guards.
export const REGIONS = ['frankfurt', 'oregon', 'ohio', 'singapore', 'virginia'] as const;
export type Region = (typeof REGIONS)[number];
export const DEFAULT_REGION: Region = 'oregon';

export const PROBE_WORKSPACE_ID = 'tea-db8i6ceq1p3s73dev9og';
const UNRELATED_WORKSPACE_ID = 'tea-d3mlbrvdiees73ca4rdg';
const RENDER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CREDENTIAL_NAME = /^[^\p{Cc}]{1,100}$/u;
const IMAGE_REF = /^([a-z0-9][a-z0-9.-]*(?::\d{1,5})?(?:\/[a-z0-9][a-z0-9._-]*)+)@sha256:([0-9a-f]{64})$/;

export interface ImageRef {
  readonly ref: string;
  readonly repository: string;
  readonly digest: string;
}

export interface ProbeInputs {
  readonly owner: string;
  readonly registryCredential: string;
  readonly image: ImageRef;
  readonly secondImage: ImageRef;
  readonly region: Region;
  readonly dryRun: boolean;
  readonly preflightOnly: boolean;
  readonly serviceId?: string;
  readonly keep: boolean;
  readonly steps: readonly StepId[];
}

export class UsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const USAGE = [
  'Usage: node script/spike/render-tenant-lifecycle.ts --owner <ownerId> --registry-credential <ID or name>',
  '         --image <repository@sha256:digest> --second-image <repository@sha256:digest>',
  '         [--region <region>] [--dry-run] [--preflight] [--service-id <ID>] [--steps <step,...>] [--keep]',
  '',
  'Real mode reads RENDER_API_KEY from the environment and never prints it. Give it the git-ignored .env.local',
  'of the main checkout: node --env-file=<main checkout>/.env.local script/spike/render-tenant-lifecycle.ts ...',
  '  --dry-run      Print the calls that the same options send. No network call, no key.',
  '  --preflight    Make only the reads of the preflight. The client refuses each write.',
  `  --service-id   Use this live ${SERVICE_PREFIX}* private service of the owner. No create.`,
  '  --steps        Run only these steps, in the fixed order: create, internal-address, image-2, plan-change,',
  '                 suspend-resume. The default is all of them, or all but create with --service-id.',
  '  --keep         Keep the service when every step passed. After a failure, the cleanup deletes it.',
  `The probes run in the workspace Thermus AI, ${PROBE_WORKSPACE_ID}, in a service named ${SERVICE_PREFIX}<time>.`,
  `The probe touches no other service, and it refuses the production service ${PRODUCTION_SERVICE_ID}.`,
  'Both images must name one repository.',
  `Regions: ${REGIONS.join(', ')}. The default is ${DEFAULT_REGION}, the region of production.`,
].join('\n');

export function parseInputs(args: readonly string[]): ProbeInputs {
  const { values } = parseOptions(args);
  const image = imageRef(required(values.image, '--image'), '--image');
  const secondImage = imageRef(required(values['second-image'], '--second-image'), '--second-image');
  if (secondImage.repository !== image.repository) {
    throw new UsageError('--second-image must name the repository of --image: a deploy with imageUrl keeps the host, repository, and image name.');
  }
  if (secondImage.digest === image.digest) throw new UsageError('--second-image must name another digest than --image.');
  const serviceId = values['service-id'] === undefined ? undefined : reusedServiceId(values['service-id']);
  const preflightOnly = values.preflight === true;
  if (preflightOnly && (values.steps !== undefined || values.keep === true)) {
    throw new UsageError('--preflight makes only the reads of the preflight, so it takes no --steps and no --keep.');
  }
  const selection = stepSelection(values.steps, serviceId !== undefined);
  if ('problem' in selection) throw new UsageError(selection.problem);
  const inputs: ProbeInputs = {
    owner: ownerId(required(values.owner, '--owner')),
    registryCredential: credential(required(values['registry-credential'], '--registry-credential')),
    image,
    secondImage,
    region: region(values.region ?? DEFAULT_REGION),
    dryRun: values['dry-run'] === true,
    preflightOnly,
    serviceId,
    keep: values.keep === true,
    steps: selection.steps,
  };
  return Object.freeze(inputs);
}

export function readApiKey(environment: Environment): string {
  const key = environment.RENDER_API_KEY ?? '';
  if (key.trim() === '') throw new UsageError('RENDER_API_KEY is not set. Real mode needs a Render API key in the environment; --dry-run needs none.');
  if (/[\s\p{Cc}]/u.test(key)) throw new UsageError('RENDER_API_KEY must not contain spaces or control characters.');
  return key;
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
      'second-image': { type: 'string' },
      region: { type: 'string' },
      'dry-run': { type: 'boolean' },
      preflight: { type: 'boolean' },
      'service-id': { type: 'string' },
      steps: { type: 'string' },
      keep: { type: 'boolean' },
    },
  });
}

export function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') throw new UsageError(`${name} is required.`);
  return value;
}

export function ownerId(value: string): string {
  const owner = renderId(value, '--owner');
  if (owner === UNRELATED_WORKSPACE_ID) throw new UsageError(`--owner names ${UNRELATED_WORKSPACE_ID}, My Workspace, which the probes must not use. The probes run in Thermus AI, ${PROBE_WORKSPACE_ID}.`);
  return owner;
}

export function reusedServiceId(value: string, name = '--service-id'): string {
  const id = renderId(value, name);
  if (id === PRODUCTION_SERVICE_ID) throw new UsageError(`${name} names ${PRODUCTION_SERVICE_ID}, the production service. The probe never touches it.`);
  return id;
}

function renderId(value: string, name: string): string {
  if (!RENDER_ID.test(value)) throw new UsageError(`${name} must be a Render ID: letters, digits, hyphens, or underscores.`);
  return value;
}

export function credential(value: string): string {
  if (!CREDENTIAL_NAME.test(value)) throw new UsageError('--registry-credential must be a credential ID or name of 1 to 100 characters, without control characters.');
  return value;
}

export function imageRef(value: string, name: string): ImageRef {
  const match = IMAGE_REF.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new UsageError(`${name} must be an image reference by digest, such as ghcr.io/owner/name@sha256:<64 hexadecimal digits>.`);
  }
  return Object.freeze({ ref: value, repository: match[1], digest: `sha256:${match[2]}` });
}

export function region(value: string): Region {
  const found = REGIONS.find((item) => item === value);
  if (found === undefined) throw new UsageError(`--region must be one of ${REGIONS.join(', ')}.`);
  return found;
}
