import assert from 'node:assert/strict';
import { addRow, shown } from '../render-tenant-lifecycle/context.ts';
import { readService } from '../render-tenant-lifecycle/waits.ts';
import { controlPlaneTargets, lookupAndHealthProgram } from './calls.ts';
import { addressOf, sessionOf, type ProbeContext, type Role } from './context.ts';
import type { StepId } from './inputs.ts';
import type { ProbeLine } from './job-logs.ts';
import { runJob } from './job.ts';

const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// The router of Render answered 502 for a new web service once after its deploy was live (SO-01d), so the job
// waits before it requests a web service that is new.
export const CONTROL_PLANE_SETTLE_MS = 60_000;

// SO-03: the job runs on the private service, as a tenant would, and requests the web service, the control plane.
// Only an answer of the web service on the private network decides the step; the other requests are controls.
export async function controlPlaneJob(context: ProbeContext): Promise<string> {
  const web = await readService(sessionOf(context, 'web'));
  const slug = web.slug ?? '';
  addRow(context, 'Control plane', { check: 'Slug of the web service', expected: 'a host name of letters, digits, and hyphens', measured: shown(web.slug) });
  assert.ok(SLUG.test(slug), `The slug ${shown(web.slug)} of the web service is not a host name of letters, digits, and hyphens`);
  const privateSlug = addressOf(context).slug;
  const targets = controlPlaneTargets({ slug, publicUrl: web.url ?? '' }, privateSlug);
  const names = [slug, privateSlug];
  const decides = (line: ProbeLine): boolean => line.from === targets[1]?.from || line.from === targets[2]?.from;
  const program = lookupAndHealthProgram(names, targets, context.run);
  return runJob(context, { step: 'Control plane', on: 'private', program, names, targets, decides, settleMs: CONTROL_PLANE_SETTLE_MS });
}

// The service of the last job of the selected steps: control-plane runs its job on the private service, and job on
// the web service. The real cleanup reads the service of the job from the state instead.
export function lastJobRole(steps: readonly StepId[]): Role {
  return steps.includes('control-plane') ? 'private' : 'web';
}
