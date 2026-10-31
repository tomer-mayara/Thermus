// The steps of the rehearsal on the staging control plane thermus-spike-control: the create as a Git build (R1), the
// host settings (R2), the switch to the image (R4), the variables of the gateway switch (R7) and of the rollback (R14),
// and the switch back to the Git build (R14, a measure only). Each write names the confirmed service.
import { fieldJson, fieldText } from '../../spike/render-tenant-lifecycle/answers.ts';
import { limitsText, messageOf, type RehearsalRender } from './rehearsal-render.ts';
import {
  CA_FILE_NAME, CANDIDATE_DIGEST, CONTROL_NAME, FREE_PLAN, imageOf, OWNER_ID, REGION, REGISTRY_CREDENTIAL_ID, REPOSITORY, utcNow,
} from './rehearsal-settings.ts';
import { shownVariable, type Variables } from './rehearsal-variables.ts';

type Print = (line: string) => void;

/** The confirmed service of one write and the output of the command. */
export interface ServiceTarget {
  readonly render: RehearsalRender;
  readonly serviceId: string;
  readonly print: Print;
}

const DOCKER = { dockerContext: '.', dockerfilePath: './Dockerfile.hosted' } as const;

/** The body of step R1. The report gives the variables with their values, and each secret as its length only. */
function createBody(variables: Variables, caPem: string): Record<string, unknown> {
  return {
    type: 'web_service',
    name: CONTROL_NAME,
    ownerId: OWNER_ID,
    repo: REPOSITORY,
    branch: 'main',
    autoDeploy: 'no',
    envVars: variables.map(([key, value]) => ({ key, value })),
    secretFiles: [{ name: CA_FILE_NAME, content: caPem }],
    serviceDetails: { runtime: 'docker', plan: FREE_PLAN, region: REGION, numInstances: 1, healthCheckPath: '/healthz', envSpecificDetails: DOCKER },
  };
}

export async function createControl(render: RehearsalRender, plan: { readonly variables: Variables; readonly caPem: string }, print: Print): Promise<{ readonly serviceId: string; readonly slug: string; readonly origin: string }> {
  const { variables, caPem } = plan;
  if (await render.confirmNamed(CONTROL_NAME) !== undefined) throw new Error(`A service named ${CONTROL_NAME} exists already. Nothing changed.`);
  print(`Variables: ${variables.map(shownVariable).join('; ')}`);
  print(`Secret file: ${CA_FILE_NAME}, ${caPem.length} characters`);
  const sent = utcNow();
  const answer = await render.write('R1 create', { method: 'POST', path: '/services', body: createBody(variables, caPem) });
  const service = fieldJson(answer.json, 'service');
  const serviceId = fieldText(service, 'id') ?? '';
  render.client.confirmOwnService(serviceId, fieldText(service, 'name'));
  const slug = fieldText(service, 'slug') ?? '';
  const url = fieldText(fieldJson(service, 'serviceDetails'), 'url') ?? '';
  print(`POST /services at ${sent}: ${answer.status} after ${(answer.ms / 1_000).toFixed(1)} s; ${limitsText(answer)}`);
  print(`Service ${serviceId}, slug ${slug}, url ${url}, first deploy ${fieldText(answer.json, 'deployId') ?? 'absent'}`);
  return { serviceId, slug, origin: url.replace(/\/$/, '') };
}

/** One PUT for each variable, in the order of the list, with the time and the rate-limit headers of each answer. */
export async function putVariables({ render, serviceId, print }: ServiceTarget, variables: Variables): Promise<string> {
  let first = '';
  for (const variable of variables) {
    const at = utcNow();
    first ||= at;
    const answer = await render.putVariable(serviceId, variable[0], variable[1]);
    print(`${at} PUT ${shownVariable(variable)}: ${answer.status}; ${limitsText(answer)}`);
  }
  return first;
}

/** Step R4: the switch of the Git build to the image of the candidate. */
export function imageBody(): Record<string, unknown> {
  return { image: { ownerId: OWNER_ID, imagePath: imageOf(CANDIDATE_DIGEST), registryCredentialId: REGISTRY_CREDENTIAL_ID }, serviceDetails: { runtime: 'image' } };
}

/** Step R14, a measure only: the switch of the image service back to the Git build. */
export function gitBody(): Record<string, unknown> {
  return { repo: REPOSITORY, branch: 'main', serviceDetails: { runtime: 'docker', envSpecificDetails: DOCKER } };
}

export async function patchControl({ render, serviceId, print }: ServiceTarget, body: Record<string, unknown>): Promise<void> {
  const at = utcNow();
  print(`PATCH /services/${serviceId} at ${at} with ${JSON.stringify(body)}`);
  try {
    const answer = await render.write('PATCH', { method: 'PATCH', path: `/services/${serviceId}`, body });
    print(`Answer: ${answer.status} after ${(answer.ms / 1_000).toFixed(1)} s; ${limitsText(answer)}`);
    printService(answer.json, print);
  } catch (error) {
    print(`Answer: refused: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/** The fields of a service that hold no secret: no variable and no secret file is part of a service answer. */
export function printService(value: unknown, print: Print): void {
  const details = fieldJson(value, 'serviceDetails');
  const env = fieldJson(details, 'envSpecificDetails');
  const credential = fieldJson(value, 'registryCredential');
  const parts = [
    `id ${fieldText(value, 'id')}`, `name ${fieldText(value, 'name')}`, `type ${fieldText(value, 'type')}`, `slug ${fieldText(value, 'slug')}`,
    `url ${fieldText(details, 'url')}`, `runtime ${fieldText(details, 'runtime')}`, `plan ${fieldText(details, 'plan')}`, `region ${fieldText(details, 'region')}`,
    `repo ${fieldText(value, 'repo') ?? '-'}`, `branch ${fieldText(value, 'branch') ?? '-'}`, `autoDeploy ${fieldText(value, 'autoDeploy')}`,
    `imagePath ${fieldText(value, 'imagePath') ?? '-'}`, `registryCredential ${fieldText(credential, 'id') ?? '-'} ${fieldText(credential, 'name') ?? ''}`.trim(),
    `dockerfilePath ${fieldText(env, 'dockerfilePath') ?? '-'}`, `healthCheckPath ${fieldText(details, 'healthCheckPath') ?? '-'}`, `suspended ${fieldText(value, 'suspended')}`,
  ];
  print(parts.join('; '));
  const message = messageOf(value);
  if (message !== '') print(`message: ${message}`);
}

export function printDeploy(value: unknown, print: Print): void {
  const image = fieldJson(value, 'image');
  const commit = fieldJson(value, 'commit');
  print([
    fieldText(value, 'id'), fieldText(value, 'status'), `trigger ${fieldText(value, 'trigger')}`, `created ${fieldText(value, 'createdAt')}`,
    `started ${fieldText(value, 'startedAt') ?? '-'}`, `finished ${fieldText(value, 'finishedAt') ?? '-'}`, `image ${fieldText(image, 'sha') ?? '-'}`, `commit ${fieldText(commit, 'id') ?? '-'}`,
  ].join('  '));
}
