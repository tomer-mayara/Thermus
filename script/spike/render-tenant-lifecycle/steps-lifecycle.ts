import assert from 'node:assert/strict';
import { FREE_PLAN, resumeCall, suspendCall, TEAM_PLAN, updatePlanCall } from './calls.ts';
import { samePlan, serviceOf, type DeployView } from './answers.ts';
import { addField, addRow, seconds, serviceIdOf, shown, type ProbeContext, type Row, type ServiceSession } from './context.ts';
import { imageName } from './steps-service.ts';
import {
  deployIds, deployImage, deployStartedByRender, eventTypesSince, instanceIds, listedDeploy, readService, waitForLive, waitForSuspended,
} from './waits.ts';

// The image of the deploy that applies a plan, the words that name it in a row, and the name of the image of a deploy.
export interface PlanImage {
  readonly url: string;
  readonly label: string;
  nameOf(deploy: DeployView): string;
}

export type PlanSession = ServiceSession & { readonly report: { readonly rows: Row[] } };

// The update alone does not apply the plan; the next successful deploy does (render.com/docs/compute-plans).
async function applyPlan(context: PlanSession, step: string, change: { readonly known: ReadonlySet<string>; readonly image: PlanImage }): Promise<{ readonly id: string; readonly by: string; readonly at: number; readonly from: string }> {
  const byRender = await deployStartedByRender(context, change.known);
  if (byRender !== undefined) return { id: byRender.id, by: `Render (trigger ${shown(byRender.trigger)})`, at: performance.now(), from: 'the probe saw it' };
  const at = performance.now();
  const deploy = await deployImage(context, step, { known: change.known, imageUrl: change.image.url });
  return { id: deploy.id, by: `the probe, with ${change.image.label} (answer ${deploy.status})`, at, from: 'the deploy call' };
}

function replacement(before: readonly string[], after: readonly string[]): string {
  const added = after.filter((id) => !before.includes(id));
  if (added.length === 0) return `no: the same instances (${before.join(', ') || 'none'})`;
  const kept = before.filter((id) => after.includes(id));
  const old = kept.length === 0 ? 'the old instance is no longer listed' : `the old instance ${kept.join(', ')} is still listed`;
  return `yes: new instance ${added.join(', ')}; ${old}`;
}

export async function changePlan(context: PlanSession, plan: string, image: PlanImage): Promise<string> {
  const step = `Plan ${plan}`;
  const before = await instanceIds(context);
  const known = await deployIds(context);
  const since = Date.now();
  const started = performance.now();
  const answer = await context.client.write(step, updatePlanCall(serviceIdOf(context), plan), context.signal);
  const answered = serviceOf(answer.json).plan;
  addRow(context, step, { check: 'Update answer', expected: `plan ${plan}`, measured: `${answer.status}, plan ${shown(answered)}, after ${seconds(answer.ms)}` });
  assert.ok(samePlan(answered, plan), `The update answer shows plan ${shown(answered)}, not ${plan}`);
  const applied = await applyPlan(context, step, { known, image });
  const live = await waitForLive(context, applied.id, started);
  const fromDeploy = `${seconds(live.ms - (applied.at - started))} after ${applied.from}`;
  addRow(context, step, { check: 'Deploy that applies the plan', expected: 'live', measured: `started by ${applied.by}; live ${seconds(live.ms)} after the update and ${fromDeploy} (${live.statuses.join(' > ')}); ${image.nameOf(live.deploy)}` });
  const after = await readService(context);
  addRow(context, step, { check: 'Service after the deploy', expected: `plan ${plan}`, measured: `plan ${shown(after.plan)}` });
  const restarted = replacement(before, await instanceIds(context));
  addRow(context, step, { check: 'Container restarted', expected: 'recorded; docs: the deploy starts a new instance', measured: restarted });
  const events = await eventTypesSince(context, since);
  addRow(context, step, { check: 'Event types since the update', expected: 'recorded', measured: events.join(', ') || 'none' });
  assert.ok(samePlan(after.plan, plan), `After the deploy, the service shows plan ${shown(after.plan)}, not ${plan}`);
  return `the update answer showed ${plan}; the deploy that applied it was started by ${applied.by} and was live ${seconds(live.ms)} after the update; container restarted: ${restarted}.`;
}

export async function planChange(context: ProbeContext): Promise<string> {
  const image: PlanImage = { url: context.inputs.secondImage.ref, label: 'image 2', nameOf: (deploy) => imageName(context, deploy) };
  const up = await changePlan(context, TEAM_PLAN, image);
  const down = await changePlan(context, FREE_PLAN, image);
  addField(context, 'service.serviceDetails.plan', { answer: 'PATCH /services/{id} (200)', value: `${TEAM_PLAN}, then ${FREE_PLAN}` });
  return `to ${TEAM_PLAN}: ${up} Back to ${FREE_PLAN}: ${down}`;
}

const READ_AFTER_SUSPEND = 'GET /services/{id} after the suspend';

async function suspend(context: ProbeContext): Promise<string> {
  const started = performance.now();
  const answer = await context.client.write('Suspend', suspendCall(serviceIdOf(context)), context.signal);
  assert.equal(answer.status, 202, `POST /suspend answered ${answer.status}, not 202`);
  const { service, ms } = await waitForSuspended(context, 'suspended', started);
  const instances = await instanceIds(context);
  addRow(context, 'Suspend', { check: 'State after the suspend call', expected: 'suspended', measured: `suspended ${seconds(ms)} after the call; suspenders ${service.suspenders.join(', ') || 'none'}; instances listed: ${instances.length}` });
  addField(context, 'service.suspended, service.suspenders', { answer: READ_AFTER_SUSPEND, value: `suspended; ${service.suspenders.join(', ') || 'none'}` });
  return `the state was suspended ${seconds(ms)} after the call`;
}

async function resume(context: ProbeContext): Promise<string> {
  const known = await deployIds(context);
  const started = performance.now();
  const answer = await context.client.write('Resume', resumeCall(serviceIdOf(context)), context.signal);
  assert.equal(answer.status, 202, `POST /resume answered ${answer.status}, not 202`);
  const resumed = await waitForSuspended(context, 'not_suspended', started);
  addRow(context, 'Resume', { check: 'State after the resume call', expected: 'not_suspended', measured: `not_suspended ${seconds(resumed.ms)} after the call` });
  const deploy = await listedDeploy(context, known);
  const live = await waitForLive(context, deploy.id, started);
  const image = imageName(context, live.deploy);
  addRow(context, 'Resume', { check: 'Deploy after the resume', expected: 'live; time recorded', measured: `trigger ${shown(live.deploy.trigger)}; live ${seconds(live.ms)} after the resume call (${live.statuses.join(' > ')}); ${image}` });
  addField(context, 'deploy.trigger after a resume', { answer: 'GET /services/{id}/deploys', value: shown(live.deploy.trigger) });
  return `the resume deploy (trigger ${shown(live.deploy.trigger)}) was live ${seconds(live.ms)} after the resume call and runs ${image}`;
}

export async function suspendResume(context: ProbeContext): Promise<string> {
  const since = Date.now();
  const suspended = await suspend(context);
  const resumed = await resume(context);
  const events = await eventTypesSince(context, since);
  addRow(context, 'Resume', { check: 'Event types since the suspend', expected: 'recorded', measured: events.join(', ') || 'none' });
  return `${suspended}; ${resumed}.`;
}
