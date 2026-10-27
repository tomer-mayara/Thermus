import assert from 'node:assert/strict';
import { fieldJson, fieldText, renderId } from '../render-tenant-lifecycle/answers.ts';
import { addRow, progress, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { poll, sleep } from '../render-tenant-lifecycle/polls.ts';
import { readService } from '../render-tenant-lifecycle/waits.ts';
import { controlPlaneTargets, healthProgram, healthTargets, jobCall, jobStatusCall, lookupAndHealthProgram, startCommand, type Target } from './calls.ts';
import { addressOf, sessionOf, type ProbeContext, type Role } from './context.ts';
import { readProbeLines, transcriptOf, type LinesRead, type ProbeLine } from './job-logs.ts';

export const JOB_POLL = { everyMs: 5_000, attempts: 60 } as const;
export const JOB_ENDED = new Set(['succeeded', 'failed', 'canceled']);
const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

// One job: its step in the report, the service that runs it, and the requests of its program. SO-03 adds a program
// with DNS lines, the requests that decide the step, and a wait before the job.
interface JobPlan {
  readonly step: string;
  readonly on: Role;
  readonly targets: readonly Target[];
  readonly names?: readonly string[];
  readonly decides?: (line: ProbeLine) => boolean;
  readonly settleMs?: number;
}

// The router of Render answered 502 for a new web service once after its deploy was live (SO-01d), so the job
// waits before it requests a web service that is new.
export const CONTROL_PLANE_SETTLE_MS = 60_000;

export interface JobView {
  readonly id: string;
  readonly status?: string;
  readonly planId?: string;
  readonly createdAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export function jobOf(value: unknown): JobView {
  const text = (key: string): string | undefined => fieldText(value, key);
  return { id: renderId(fieldJson(value, 'id'), 'job.id'), status: text('status'), planId: text('planId'), createdAt: text('createdAt'), startedAt: text('startedAt'), finishedAt: text('finishedAt') };
}

// startedAt and finishedAt have whole seconds, and createdAt has fractions, so a start can come out below zero.
function between(from: string | undefined, to: string | undefined): string {
  const start = Date.parse(from ?? '');
  const end = Date.parse(to ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'unknown';
  return end < start ? 'under 1 s' : seconds(end - start);
}

async function createJob(context: ProbeContext, plan: JobPlan & { readonly serviceId: string }, command: string): Promise<{ readonly job: JobView; readonly started: number }> {
  const started = performance.now();
  const answer = await context.client.write(plan.step, jobCall(plan.serviceId, command), context.signal);
  assert.equal(answer.status, 201, `POST /services/${plan.serviceId}/jobs answered ${answer.status}, not 201`);
  const job = jobOf(answer.json);
  context.state.job = { id: job.id, serviceId: plan.serviceId, status: job.status };
  progress(`started the job ${job.id} on ${plan.serviceId}`);
  addRow(context, plan.step, { check: 'Create answer', expected: '201 with the job', measured: `201 after ${seconds(answer.ms)}: ${job.id}, plan ${shown(job.planId)}, status ${shown(job.status)}` });
  return { job, started };
}

async function waitForEnd(context: ProbeContext, plan: JobPlan & { readonly serviceId: string }, created: { readonly job: JobView; readonly started: number }): Promise<JobView> {
  const statuses: string[] = [];
  const ended = await poll({ plan: JOB_POLL, signal: context.signal, what: `job ${created.job.id} to end` }, async () => {
    const job = jobOf((await context.client.read(jobStatusCall(plan.serviceId, created.job.id), context.signal)).json);
    const status = job.status ?? 'absent';
    if (context.state.job !== undefined) context.state.job.status = status;
    if (statuses.at(-1) !== status) {
      statuses.push(status);
      progress(`job ${job.id}: ${status} after ${seconds(performance.now() - created.started)}`);
    }
    return JOB_ENDED.has(status) ? job : undefined;
  });
  const render = `Render: createdAt ${ended.createdAt ?? 'absent'}, startedAt ${ended.startedAt ?? 'absent'}, finishedAt ${ended.finishedAt ?? 'absent'}; ${between(ended.createdAt, ended.startedAt)} to start, ${between(ended.startedAt, ended.finishedAt)} to run`;
  addRow(context, plan.step, { check: 'Job end', expected: 'succeeded; times recorded', measured: `${ended.status} ${seconds(performance.now() - created.started)} after the create call (${statuses.join(' > ')}); ${render}` });
  return ended;
}

function lineText(line: ProbeLine): string {
  const ms = line.ms === undefined ? '' : `, after ${line.ms} ms`;
  if (line.from.startsWith('dns:') && line.status === 0) return `addresses ${line.body || 'none'}${ms}`;
  if (line.status !== undefined) return `${line.status}, body ${JSON.stringify(line.body ?? '')}${ms}`;
  return `no answer: ${line.error ?? 'no error name'}, "${line.message ?? ''}"${ms}`;
}

function lineOk(line: ProbeLine): boolean {
  return line.status === 200 && line.body?.trim() === 'ok';
}

function readSummary(read: LinesRead): string {
  const resources = [...new Set(read.lines.map((line) => line.entry.labels.resource ?? 'absent'))].join(', ') || 'none';
  const limits = `Ratelimit-Limit ${read.limits.limit ?? 'absent'}, Ratelimit-Remaining ${read.limits.remaining ?? 'absent'}`;
  const reads = `${read.reads} ${read.reads === 1 ? 'read' : 'reads'}`;
  return `${read.lines.length} of ${read.entries} log entries, ${seconds(read.ms)} after the job end (${reads} of GET /logs with resource ${read.resources.join(' and ')}; the last read: ${limits}); resource label of the lines: ${resources}`;
}

function expectedLines(plan: JobPlan): string {
  return plan.names === undefined ? `${plan.targets.length}, one for each request` : `${plan.targets.length + plan.names.length}, one for each lookup and request`;
}

function recordLines(context: ProbeContext, plan: JobPlan, read: LinesRead): readonly ProbeLine[] {
  addRow(context, plan.step, { check: 'Log lines of this run', expected: expectedLines(plan), measured: readSummary(read) });
  context.report.transcript.push(...transcriptOf(read.lines));
  const measured = (from: string): string => {
    const line = read.lines.find((item) => item.from === from);
    return line === undefined ? 'no line' : lineText(line);
  };
  for (const name of plan.names ?? []) addRow(context, plan.step, { check: `DNS lookup of ${name} in the job`, expected: 'recorded', measured: measured(`dns:${name}`) });
  for (const target of plan.targets) {
    addRow(context, plan.step, { check: `GET ${target.url} in the job (${target.from})`, expected: 'recorded; one request at least answers 200 with ok', measured: measured(target.from) });
  }
  return read.lines;
}

export function job(context: ProbeContext): Promise<string> {
  const address = addressOf(context);
  return runJob(context, { step: 'Job', on: 'web', targets: healthTargets(address.slug, address.url) });
}

// SO-03: the job runs on the private service, as a tenant would, and requests the web service, the control plane.
// Only an answer of the web service on the private network decides the step; the other requests are controls.
export async function controlPlaneJob(context: ProbeContext): Promise<string> {
  const web = await readService(sessionOf(context, 'web'));
  const slug = web.slug ?? '';
  addRow(context, 'Control plane', { check: 'Slug of the web service', expected: 'a host name of letters, digits, and hyphens', measured: shown(web.slug) });
  assert.ok(SLUG.test(slug), `The slug ${shown(web.slug)} of the web service is not a host name of letters, digits, and hyphens`);
  const privateSlug = addressOf(context).slug;
  const targets = controlPlaneTargets({ slug, publicUrl: web.url ?? '' }, privateSlug);
  const decides = (line: ProbeLine): boolean => line.from === targets[1]?.from || line.from === targets[2]?.from;
  return runJob(context, { step: 'Control plane', on: 'private', targets, names: [slug, privateSlug], decides, settleMs: CONTROL_PLANE_SETTLE_MS });
}

async function runJob(context: ProbeContext, plan: JobPlan): Promise<string> {
  const serviceId = serviceIdOf(sessionOf(context, plan.on));
  if (plan.settleMs !== undefined) {
    progress(`waiting ${seconds(plan.settleMs)} before the job`);
    await sleep(plan.settleMs, context.signal);
    addRow(context, plan.step, { check: 'Wait before the job', expected: 'recorded', measured: seconds(plan.settleMs) });
  }
  const program = plan.names === undefined ? healthProgram(plan.targets, context.run) : lookupAndHealthProgram(plan.names, plan.targets, context.run);
  const command = startCommand(program);
  context.report.startCommand = command;
  const created = await createJob(context, { ...plan, serviceId }, command);
  const ended = await waitForEnd(context, { ...plan, serviceId }, created);
  const createdAt = Date.parse(ended.createdAt ?? '');
  const since = { createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - 600_000, targets: plan.targets.length + (plan.names?.length ?? 0) };
  // The lines of a job carry the job ID as their resource, not the ID of its service (development run of SO-01d).
  const lines = recordLines(context, plan, await readProbeLines(context, [serviceId, ended.id], since));
  assert.ok(lines.length > 0, `The logs of ${serviceId} and ${ended.id} hold no line of this run (the job ended ${shown(ended.status)}). The job may not have run the start command.`);
  const decides = plan.decides ?? ((): boolean => true);
  const ok = lines.filter((line) => lineOk(line) && decides(line)).map((line) => line.from);
  const failed = lines.filter((line) => !(lineOk(line) && decides(line))).map((line) => `${line.from}: ${lineText(line)}`);
  assert.ok(ok.length > 0, `No deciding request of the job answered 200 with ok: ${failed.join('; ')}`);
  return `the job ${ended.id} ended ${ended.status}; 200 with ok from ${ok.join(', ')}; ${failed.length === 0 ? 'no request failed' : `other answers: ${failed.join('; ')}`}.`;
}
