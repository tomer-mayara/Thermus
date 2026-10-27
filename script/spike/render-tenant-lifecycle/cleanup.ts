import assert from 'node:assert/strict';
import { deleteServiceCall, servicesNamedCall } from './calls.ts';
import { listItems, serviceOf } from './answers.ts';
import { addRow, messageOf, seconds, type ProbeContext, type ProbeStep } from './context.ts';
import { poll, POLLS, watch } from './polls.ts';
import { probeServices } from './waits.ts';

async function servicesToDelete(context: ProbeContext): Promise<readonly string[]> {
  if (context.state.serviceId !== undefined) return [context.state.serviceId];
  if (!context.state.createSent) return [];
  const named = await watch({ plan: POLLS.window, signal: context.signal, what: `a service named ${context.name}` }, async () => {
    const answer = await context.client.read(servicesNamedCall(context.inputs.owner, context.name), context.signal);
    const ids = listItems(answer.json, 'service').items.map(serviceOf).filter((service) => service.name === context.name).map((service) => service.id);
    for (const id of ids) context.client.confirmOwnService(id, context.name);
    return ids.length > 0 ? ids : undefined;
  });
  return named ?? [];
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
  const remaining = await poll({ plan: POLLS.cleanup, signal: context.signal, what: `${name} to leave the service list` }, async () => {
    const names = (await probeServices(context, context.signal)).map((service) => service.name);
    return names.includes(name) ? undefined : names;
  });
  assert.deepEqual(remaining, [], `Services of an earlier run remain: ${remaining.join(', ')}. Delete them in the Render Dashboard.`);
  addRow(context, 'Cleanup', { check: 'Services named thermus-spike-*', expected: '0', measured: `0, ${seconds(performance.now() - started)} after the delete` });
  return `${ids.length === 0 ? 'no service of this run existed' : `deleted ${ids.join(', ')}`}; no service named thermus-spike-* exists.`;
}

export const cleanupStep: ProbeStep = {
  name: 'Cleanup',
  spec: 'Given any step, when the probe fails or ends, then it deletes the service, unless --keep, and no other service named thermus-spike-* exists.',
  run: cleanup,
};
