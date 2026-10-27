import assert from 'node:assert/strict';
import type { Call } from './calls.ts';
import { fieldJson, renderId, serviceOf, type DeployView, type ServiceView } from './answers.ts';
import { seconds, type ServiceSession } from './context.ts';

export interface CreatedService {
  readonly service: ServiceView;
  readonly deployId: string;
  readonly ms: number;
}

interface CreateTarget extends ServiceSession {
  readonly state: { createSent: boolean; serviceId?: string };
}

// The create goes one time only, because a repeated create can make a second service. createSent is set before the
// write, so that the cleanup looks for the service by its name when the answer is lost.
export async function sendCreate(target: CreateTarget, step: string, call: Call): Promise<CreatedService> {
  target.state.createSent = true;
  const answer = await target.client.write(step, call, target.signal);
  assert.equal(answer.status, 201, `POST /services answered ${answer.status}, not 201`);
  const service = serviceOf(fieldJson(answer.json, 'service'));
  target.client.confirmOwnService(service.id, service.name);
  target.state.serviceId = service.id;
  return { service, deployId: renderId(fieldJson(answer.json, 'deployId'), 'deployId'), ms: answer.ms };
}

export function renderTimes(deploy: DeployView): string {
  const created = Date.parse(deploy.createdAt ?? '');
  const finished = Date.parse(deploy.finishedAt ?? '');
  if (!Number.isFinite(created) || !Number.isFinite(finished)) return 'Render times absent';
  return `Render: createdAt ${deploy.createdAt}, finishedAt ${deploy.finishedAt}, ${seconds(finished - created)}`;
}
