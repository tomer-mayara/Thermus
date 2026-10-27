import assert from 'node:assert/strict';
import { deleteServiceCall, PRIVATE_SERVICES } from './calls.ts';
import { addRow, messageOf, seconds, type ProbeContext, type ProbeStep } from './context.ts';
import { createdIds, untilGone } from './create.ts';
import { probeServices } from './waits.ts';

function servicesToDelete(context: ProbeContext): Promise<readonly string[]> {
  const { serviceId, createSent } = context.state;
  return createdIds({ client: context.client, signal: context.signal, owner: context.inputs.owner }, { serviceId, createSent, name: context.name });
}

async function deleteService(context: ProbeContext, id: string): Promise<void> {
  try {
    const answer = await context.client.remove('Cleanup', deleteServiceCall(id), context.signal);
    addRow(context, 'Cleanup', { check: `Delete ${id}`, expected: '204, or 404 when already gone', measured: `${answer.status} after ${seconds(answer.ms)}` });
  } catch (error) {
    throw new Error(`${messageOf(error)}. Delete ${context.state.serviceName ?? context.name} (${id}) in the Render Dashboard.`, { cause: error });
  }
}

async function keepService(context: ProbeContext): Promise<string> {
  const { serviceId, serviceName } = context.state;
  const others = (await probeServices(context, context.signal)).filter((service) => service.id !== serviceId);
  const kept = serviceId === undefined ? 'none' : `${serviceName ?? 'no name'} (${serviceId})`;
  addRow(context, 'Cleanup', { check: 'Kept service (--keep)', expected: 'the service of this run only', measured: `${kept}; other thermus-spike-* services: ${others.length}` });
  assert.deepEqual(others.map((service) => service.name), [], `Other services named thermus-spike-* exist: ${others.map((service) => service.name).join(', ')}.`);
  return serviceId === undefined ? 'no service of this run existed.' : `kept ${kept}. A later run with --service-id ${serviceId} and without --keep deletes it.`;
}

async function cleanup(context: ProbeContext): Promise<string> {
  if (context.inputs.keep) return keepService(context);
  const ids = await servicesToDelete(context);
  for (const id of ids) await deleteService(context, id);
  const name = context.state.serviceName ?? context.name;
  const started = performance.now();
  const lister = { client: context.client, signal: context.signal, owner: context.inputs.owner };
  const remaining = await untilGone(lister, { names: [name], types: PRIVATE_SERVICES, what: `${name} to leave the service list` });
  assert.deepEqual(remaining, [], `Services of an earlier run remain: ${remaining.join(', ')}. Delete them in the Render Dashboard.`);
  addRow(context, 'Cleanup', { check: 'Services named thermus-spike-*', expected: '0', measured: `0, ${seconds(performance.now() - started)} after the delete` });
  return `${ids.length === 0 ? 'no service of this run existed' : `deleted ${ids.join(', ')}`}; no service named thermus-spike-* exists.`;
}

export const cleanupStep: ProbeStep = {
  name: 'Cleanup',
  spec: 'Given any step, when the probe fails or ends, then it deletes the service, unless --keep, and no other service named thermus-spike-* exists.',
  run: cleanup,
};
