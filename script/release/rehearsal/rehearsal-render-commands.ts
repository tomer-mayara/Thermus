// The Render commands of the rehearsal helper. Each one reads the fleet key from the environment; each write names the
// staging control plane thermus-spike-control or a thermus-spike-tenant-* service that it confirmed first.
import { setTimeout as delay } from 'node:timers/promises';
import { fieldJson, fieldText } from '../../spike/render-tenant-lifecycle/answers.ts';
import { createControl, gitBody, imageBody, patchControl, printDeploy, printService, putVariables } from './rehearsal-control.ts';
import { RehearsalRender } from './rehearsal-render.ts';
import {
  caPemOf, CONTROL_NAME, OWNER_ID, PRODUCTION_SERVICE_ID, REGISTRY_CREDENTIAL_ID, RehearsalUsageError, renderKeyOf, stateDirOf, utcNow,
} from './rehearsal-settings.ts';
import { readState, savedControl, updateState } from './rehearsal-state.ts';
import { createVariables, hostVariables, SECRET_NAMES, switchOnVariables } from './rehearsal-variables.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type Print = (line: string) => void;

export interface CommandInput {
  readonly environment: Environment;
  readonly values: Readonly<Record<string, string | boolean | undefined>>;
  readonly positionals: readonly string[];
  readonly print: Print;
  readonly signal: AbortSignal;
}

const DEPLOY_ENDED = new Set(['live', 'build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const HEALTH = { attempts: 12, everyMs: 5_000 };

function text(input: CommandInput, name: string): string {
  const value = input.values[name];
  if (typeof value !== 'string' || value === '') throw new RehearsalUsageError(`--${name} is required.`);
  return value;
}

function renderOf(input: CommandInput): RehearsalRender {
  return new RehearsalRender(renderKeyOf(input.environment), input.signal);
}

async function serviceOf(input: CommandInput, render: RehearsalRender): Promise<string> {
  const tenant = input.values.service;
  if (typeof tenant === 'string') {
    await render.confirmTenant(tenant);
    return tenant;
  }
  return render.confirmControl();
}

async function services(input: CommandInput): Promise<void> {
  const list = await renderOf(input).services();
  input.print(`${utcNow()} ${list.length} services in ${OWNER_ID}:`);
  for (const service of list) input.print(`${service.id}  ${service.name}  ${service.type}  ${service.suspended}${service.id === PRODUCTION_SERVICE_ID ? '  (production)' : ''}`);
}

async function credential(input: CommandInput): Promise<void> {
  const value = (await renderOf(input).read(`/registrycredentials/${REGISTRY_CREDENTIAL_ID}`)).json;
  input.print(`${fieldText(value, 'id')}  ${fieldText(value, 'name')}  registry ${fieldText(value, 'registry')}  user ${fieldText(value, 'username')}`);
}

async function create(input: CommandInput): Promise<void> {
  const dir = stateDirOf(input.environment);
  const guessed = `https://${CONTROL_NAME}.onrender.com`;
  const made = await createControl(renderOf(input), { variables: createVariables(input.environment, guessed), caPem: caPemOf(input.environment) }, input.print);
  updateState(dir, (state) => { state.control = made; });
  input.print(made.origin === guessed ? `The public URL is the guessed URL ${guessed}.` : `The public URL ${made.origin} differs from the guessed URL ${guessed}: step R2 sets the host variables.`);
}

async function show(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await serviceOf(input, render);
  printService(await render.service(id), input.print);
  for (const deploy of await render.deploys(id, 5)) printDeploy(deploy, input.print);
}

/** Waits until the deploy reaches an end state, and prints each new state with the time. */
async function wait(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await serviceOf(input, render);
  const deployId = text(input, 'deploy');
  const started = performance.now();
  let last = '';
  for (;;) {
    const deploy = await render.deploy(id, deployId);
    const status = fieldText(deploy, 'status') ?? 'absent';
    if (status !== last) input.print(`${utcNow()} ${deployId}: ${status} (${((performance.now() - started) / 1_000).toFixed(0)} s)`);
    last = status;
    if (DEPLOY_ENDED.has(status)) return printDeploy(deploy, input.print);
    await delay(10_000, undefined, { signal: input.signal });
  }
}

async function events(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await serviceOf(input, render);
  for (const event of await render.events(id)) {
    const details = fieldJson(event, 'details');
    const deployId = fieldText(details, 'deployId') ?? '';
    input.print(`${fieldText(event, 'timestamp')}  ${fieldText(event, 'type')}  ${deployId}`);
  }
}

/** The log lines since a time that hold one of the --match words; without --match, each line. */
async function logs(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await serviceOf(input, render);
  const words = typeof input.values.match === 'string' ? input.values.match.split('|') : [];
  const types = typeof input.values.type === 'string' ? [input.values.type] : [];
  const lines = await render.logs(id, text(input, 'since'), types);
  const shown = words.length === 0 ? lines : lines.filter((line) => words.some((word) => line.message.includes(word)));
  input.print(`${lines.length} log lines since ${text(input, 'since')}; ${shown.length} shown`);
  for (const line of shown) input.print(`${line.timestamp}  ${line.labels.type ?? ''}/${line.labels.level ?? ''}  ${line.message.slice(0, 500)}`);
}

async function health(input: CommandInput): Promise<void> {
  const origin = savedControl(readState(stateDirOf(input.environment))).origin;
  for (let attempt = 1; attempt <= HEALTH.attempts; attempt++) {
    const at = utcNow();
    const answer = await fetch(`${origin}/healthz`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).then(async (response) => `${response.status} ${JSON.stringify((await response.text()).slice(0, 40))}`, (error: unknown) => `no answer (${error instanceof Error ? error.message : String(error)})`);
    input.print(`${at} GET ${origin}/healthz: ${answer}`);
    if (answer.startsWith('200 ')) return;
    await delay(HEALTH.everyMs);
  }
  throw new Error(`${origin}/healthz did not answer 200.`);
}

/** The start of the portal sign-in: /login answers with a redirect to AuthKit; the report gives its redirect_uri. */
async function loginRedirect(input: CommandInput): Promise<void> {
  const origin = savedControl(readState(stateDirOf(input.environment))).origin;
  const response = await fetch(`${origin}/login`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  const location = new URL(response.headers.get('location') ?? '', origin);
  input.print(`GET ${origin}/login: ${response.status}; redirect to ${location.origin}${location.pathname} with redirect_uri ${location.searchParams.get('redirect_uri') ?? 'absent'}`);
}

async function setHost(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await render.confirmControl();
  const url = fieldText(fieldJson(await render.service(id), 'serviceDetails'), 'url') ?? '';
  const origin = url.replace(/\/$/, '');
  updateState(stateDirOf(input.environment), (state) => { state.control = { ...savedControl(state), origin }; });
  await putVariables({ render, serviceId: id, print: input.print }, hostVariables(origin));
}

/** PUT of plain variables only, such as SELF_SERVE_SIGNUP_ENABLED=true; a secret name is refused. */
async function set(input: CommandInput): Promise<void> {
  const pairs = input.positionals.map((pair) => {
    const at = pair.indexOf('=');
    if (at < 1 || SECRET_NAMES.has(pair.slice(0, at))) throw new RehearsalUsageError(`set takes NAME=value pairs of plain variables only: ${pair.slice(0, Math.max(at, 0))}`);
    return [pair.slice(0, at), pair.slice(at + 1)] as const;
  });
  const render = renderOf(input);
  await putVariables({ render, serviceId: await render.confirmControl(), print: input.print }, pairs);
}

async function switchOn(input: CommandInput): Promise<void> {
  const hour = Number(text(input, 'sweep-hour'));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RehearsalUsageError('--sweep-hour must be a whole number from 0 to 23.');
  const render = renderOf(input);
  const id = await render.confirmControl();
  const first = await putVariables({ render, serviceId: id, print: input.print }, switchOnVariables(input.environment, savedControl(readState(stateDirOf(input.environment))).slug, hour));
  input.print(`The first update was at ${first}.`);
}

async function tenantVariables(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = text(input, 'service');
  const name = await render.confirmTenant(id);
  const variables = await render.variables(id, ['OPERATION_CAPACITY']);
  input.print(`${id} ${name}: ${variables.length} variables: ${variables.map((item) => (item.value === undefined ? item.key : `${item.key}=${item.value}`)).join(', ')}`);
}

async function patch(input: CommandInput, body: Record<string, unknown>): Promise<void> {
  const render = renderOf(input);
  await patchControl({ render, serviceId: await render.confirmControl(), print: input.print }, body);
}

async function deleteControl(input: CommandInput): Promise<void> {
  const render = renderOf(input);
  const id = await render.confirmControl();
  const answer = await render.client.remove('cleanup', { method: 'DELETE', path: `/services/${id}` }, input.signal);
  input.print(`${utcNow()} DELETE /services/${id}: ${answer.status}`);
}

export const RENDER_COMMANDS: Readonly<Record<string, (input: CommandInput) => Promise<void>>> = {
  services, credential, create, show, wait, events, logs, health, 'login-redirect': loginRedirect, 'set-host': setHost, set,
  'switch-on': switchOn, 'tenant-vars': tenantVariables, 'to-image': (input) => patch(input, imageBody()), 'to-git': (input) => patch(input, gitBody()),
  'delete-control': deleteControl,
};
