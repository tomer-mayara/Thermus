import assert from 'node:assert/strict';
import { deleteServiceCall } from '../render-tenant-lifecycle/calls.ts';
import { addRow, messageOf, seconds } from '../render-tenant-lifecycle/context.ts';
import { createdIds, untilGone } from '../render-tenant-lifecycle/create.ts';
import { probeServices } from '../render-tenant-lifecycle/waits.ts';
import { cancelJobCall, jobStatusCall } from './calls.ts';
import { ROLES, serviceLine, type ProbeContext, type ProbeStep, type Role } from './context.ts';
import { JOB_ENDED, jobOf } from './job.ts';
import { ANY_TYPE, REUSE_OPTION } from './preflight.ts';

const STEP = 'Cleanup';
const DELETE_ORDER: readonly Role[] = ['web', 'private'];

// A job that has not ended is canceled first: the docs do not say that a delete of its service stops it.
async function cancelOpenJob(context: ProbeContext): Promise<void> {
  const job = context.state.job;
  const webId = context.state.services.web.serviceId;
  if (job === undefined || webId === undefined || JOB_ENDED.has(job.status ?? '')) return;
  const current = jobOf((await context.client.read(jobStatusCall(webId, job.id), context.signal)).json);
  if (JOB_ENDED.has(current.status ?? '')) return;
  const answer = await context.client.write(STEP, cancelJobCall(webId, job.id), context.signal);
  addRow(context, STEP, { check: `Cancel ${job.id} (status ${current.status ?? 'absent'})`, expected: '200', measured: `${answer.status} after ${seconds(answer.ms)}` });
}

// A create that got no answer can still have made the service, so the cleanup looks for its exact name (SO-01c rule).
function idsToDelete(context: ProbeContext, role: Role): Promise<readonly string[]> {
  return createdIds({ client: context.client, signal: context.signal, owner: context.inputs.owner }, context.state.services[role]);
}

async function deleteService(context: ProbeContext, role: Role, id: string): Promise<string | undefined> {
  const state = context.state.services[role];
  try {
    const answer = await context.client.remove(STEP, deleteServiceCall(id), context.signal);
    addRow(context, STEP, { check: `Delete the ${state.label} ${id}`, expected: '204, or 404 when already gone', measured: `${answer.status} after ${seconds(answer.ms)}` });
    return undefined;
  } catch (error) {
    addRow(context, STEP, { check: `Delete the ${state.label} ${id}`, expected: '204, or 404 when already gone', measured: `failed: ${messageOf(error)}` });
    return `${messageOf(error)}. Delete ${state.name} (${id}) in the Render Dashboard.`;
  }
}

async function keepServices(context: ProbeContext): Promise<string> {
  const ids = ROLES.map((role) => context.state.services[role].serviceId).filter((id) => id !== undefined);
  const others = (await probeServices(context, context.signal, ANY_TYPE)).filter((service) => !ids.includes(service.id));
  const kept = ROLES.map((role) => context.state.services[role]).filter((state) => state.serviceId !== undefined);
  addRow(context, STEP, { check: 'Kept services (--keep)', expected: 'the services of this run only', measured: `${kept.map(serviceLine).join(', ') || 'none'}; other thermus-spike-* services: ${others.length}` });
  assert.deepEqual(others.map((service) => service.name), [], `Other services named thermus-spike-* exist: ${others.map((service) => service.name).join(', ')}.`);
  const options = ROLES.filter((role) => context.state.services[role].serviceId !== undefined).map((role) => `${REUSE_OPTION[role]} ${context.state.services[role].serviceId}`);
  return kept.length === 0 ? 'no service of this run existed.' : `kept ${kept.map(serviceLine).join(' and ')}. A later run with ${options.join(' ')} and without --keep deletes them.`;
}

async function deleteAll(context: ProbeContext): Promise<readonly string[]> {
  const problems: string[] = [];
  try {
    await cancelOpenJob(context);
  } catch (error) {
    problems.push(`The job ${context.state.job?.id ?? ''} was not canceled: ${messageOf(error)}. Cancel it on the One-off Jobs page of the web service.`);
  }
  const deleted: string[] = [];
  for (const role of DELETE_ORDER) {
    for (const id of await idsToDelete(context, role)) {
      const problem = await deleteService(context, role, id);
      if (problem === undefined) deleted.push(id);
      else problems.push(problem);
    }
  }
  assert.deepEqual(problems, [], problems.join(' '));
  return deleted;
}

async function cleanup(context: ProbeContext): Promise<string> {
  if (context.inputs.keep) return keepServices(context);
  const deleted = await deleteAll(context);
  const names = ROLES.map((role) => context.state.services[role].name);
  const started = performance.now();
  const lister = { client: context.client, signal: context.signal, owner: context.inputs.owner };
  const remaining = await untilGone(lister, { names, types: ANY_TYPE, what: 'the services of this run to leave the service list' });
  addRow(context, STEP, { check: 'Services named thermus-spike-*, any type', expected: '0', measured: `${remaining.length}, ${seconds(performance.now() - started)} after the deletes` });
  assert.deepEqual(remaining, [], `Services of an earlier run remain: ${remaining.join(', ')}. Delete them in the Render Dashboard.`);
  return `${deleted.length === 0 ? 'no service of this run existed' : `deleted ${deleted.join(' and ')}`}; no service named thermus-spike-* exists.`;
}

export const cleanupStep: ProbeStep = {
  name: STEP,
  spec: 'Given any step, when the probe fails or ends, then it cancels a job that has not ended, deletes both services, unless --keep, and no service named thermus-spike-* of any type exists.',
  run: cleanup,
};
