// The commands of the second order of the rehearsal (manager decision of 31 October 2026): the cancel of a Git build
// (R1'), the watch of the deploys and events after an update (R4, R7), the fleet script with the staging registry, and
// the read of the signup page (R14).
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fieldJson, fieldText } from '../../spike/render-tenant-lifecycle/answers.ts';
import { printDeploy } from './rehearsal-control.ts';
import { limitsText, RehearsalRender } from './rehearsal-render.ts';
import type { CommandInput } from './rehearsal-render-commands.ts';
import {
  FREE_PLAN, OWNER_ID, RehearsalUsageError, renderKeyOf, stagingDatabaseUrlOf, stagingWorkOSOf, stateDirOf, TENANT_PREFIX, utcNow,
} from './rehearsal-settings.ts';
import { readState, savedControl } from './rehearsal-state.ts';

const WATCH_EVERY_MS = 10_000;
const SIGNUP_WORDS = ['Activation is closed', 'Start free access', 'Activation is temporarily unavailable'];

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

/** R1': the cancel of the Git build that is still in progress when step R4 starts. */
async function cancel(input: CommandInput): Promise<void> {
  const deployId = input.values.deploy;
  if (typeof deployId !== 'string') throw new RehearsalUsageError('--deploy is required.');
  const render = renderOf(input);
  const id = await render.confirmControl();
  printDeploy(await render.deploy(id, deployId), input.print);
  const at = utcNow();
  const answer = await render.write('R1 cancel', { method: 'POST', path: `/services/${id}/deploys/${deployId}/cancel` });
  input.print(`${at} POST /services/${id}/deploys/${deployId}/cancel: ${answer.status} after ${(answer.ms / 1_000).toFixed(1)} s; status in the answer ${fieldText(answer.json, 'status') ?? 'absent'}; ${limitsText(answer)}`);
  printDeploy(await render.deploy(id, deployId), input.print);
}

function eventKey(event: unknown): string {
  return `${fieldText(event, 'id') ?? ''}${fieldText(event, 'timestamp') ?? ''}${fieldText(event, 'type') ?? ''}`;
}

function deployKey(deploy: unknown): string {
  return `${fieldText(deploy, 'id') ?? ''}:${fieldText(deploy, 'status') ?? ''}`;
}

interface Seen {
  readonly deploys: Set<string>;
  readonly events: Set<string>;
}

// One read of the deploys and the events; each one that is new prints one line.
async function printNew({ render, id }: { readonly render: RehearsalRender; readonly id: string }, seen: Seen, print: (line: string) => void): Promise<void> {
  for (const deploy of await render.deploys(id, 20)) {
    if (!seen.deploys.has(deployKey(deploy))) printDeploy(deploy, (line) => print(`${utcNow()} new deploy state: ${line}`));
    seen.deploys.add(deployKey(deploy));
  }
  for (const event of await render.events(id)) {
    if (!seen.events.has(eventKey(event))) print(`${utcNow()} new event: ${fieldText(event, 'timestamp')} ${fieldText(event, 'type')} ${fieldText(fieldJson(event, 'details'), 'deployId') ?? ''}`);
    seen.events.add(eventKey(event));
  }
}

/** Prints each deploy and each event that is new during the window, every 10 s. */
async function watch(input: CommandInput): Promise<void> {
  const seconds = Number(input.values.seconds ?? '120');
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 1_800) throw new RehearsalUsageError('--seconds must be a whole number from 10 to 1800.');
  const render = renderOf(input);
  const id = await serviceOf(input, render);
  const seen = { deploys: new Set((await render.deploys(id, 20)).map(deployKey)), events: new Set((await render.events(id)).map(eventKey)) };
  const started = performance.now();
  input.print(`${utcNow()} watching ${id} for ${seconds} s; ${seen.deploys.size} deploy states and ${seen.events.size} events before`);
  while (performance.now() - started < seconds * 1_000) {
    await delay(WATCH_EVERY_MS, undefined, { signal: input.signal });
    await printNew({ render, id }, seen, input.print);
  }
  input.print(`${utcNow()} end of the watch`);
}

/**
 * The fleet script of SO-09 with the settings of the rehearsal: DATABASE_URL from STAGING_DATABASE_URL, the CA, the
 * workspace, the prefix thermus-spike-tenant-, and the free plan. The answer yes comes from the standard input.
 */
async function fleet(input: CommandInput): Promise<void> {
  stagingWorkOSOf(input.environment);
  const environment = {
    ...input.environment, DATABASE_URL: stagingDatabaseUrlOf(input.environment), DATABASE_CA_CERT_PATH: input.environment.REHEARSAL_CA_PATH,
    RENDER_OWNER_ID: OWNER_ID, TENANT_NAME_PREFIX: TENANT_PREFIX, TENANT_PLAN_FREE: FREE_PLAN,
  };
  input.print(`${utcNow()} fleet.ts ${input.positionals.join(' ')}`);
  const code = await new Promise<number>((done) => {
    const child = spawn(process.execPath, [resolve('script/fleet/fleet.ts'), ...input.positionals], { env: environment, stdio: 'inherit' });
    child.on('exit', (exit) => done(exit ?? 1));
  });
  input.print(`${utcNow()} fleet.ts exit code ${code}`);
  if (code !== 0) throw new Error(`The fleet script ended with exit code ${code}.`);
}

/** R14: the words of the signup page of the staging control plane, without a session. */
async function signupPage(input: CommandInput): Promise<void> {
  const origin = savedControl(readState(stateDirOf(input.environment))).origin;
  const response = await fetch(`${origin}/signup?tier=free`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  const words = SIGNUP_WORDS.filter((word) => body.includes(word));
  input.print(`${utcNow()} GET ${origin}/signup?tier=free: ${response.status}; words: ${words.join(', ') || 'none of the expected words'}${response.headers.get('location') === null ? '' : `; redirect to ${new URL(response.headers.get('location') ?? '', origin).pathname}`}`);
}

export const STEP_COMMANDS: Readonly<Record<string, (input: CommandInput) => Promise<void>>> = {
  cancel, watch, fleet, 'signup-page': signupPage,
};
