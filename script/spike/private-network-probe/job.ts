import assert from 'node:assert/strict';
import { fieldJson, fieldText, renderId } from '../render-tenant-lifecycle/answers.ts';
import { addRow, progress, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { poll, sleep } from '../render-tenant-lifecycle/polls.ts';
import { healthProgram, healthTargets, jobCall, jobStatusCall, startCommand, type Target } from './calls.ts';
import { addressOf, sessionOf, type ProbeContext, type Role } from './context.ts';
import { readProbeLines, transcriptOf, type LinesRead, type ProbeLine } from './job-logs.ts';

export const JOB_POLL = { everyMs: 5_000, attempts: 60 } as const;
export const JOB_ENDED = new Set(['succeeded', 'failed', 'canceled']);

interface JobPlan {
  readonly step: string;
  readonly on: Role;
  readonly program: string;
  readonly names: readonly string[];
  readonly targets: readonly Target[];
  readonly decides: (line: ProbeLine) => boolean;
  readonly settleMs?: number;
}

const EACH_REQUEST = (): boolean => true;

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
  return plan.names.length === 0 ? `${plan.targets.length}, one for each request` : `${plan.targets.length + plan.names.length}, one for each lookup and request`;
}

function recordLines(context: ProbeContext, plan: JobPlan, read: LinesRead): readonly ProbeLine[] {
  addRow(context, plan.step, { check: 'Log lines of this run', expected: expectedLines(plan), measured: readSummary(read) });
  context.report.transcript.push(...transcriptOf(read.lines));
  const measured = (from: string): string => {
    const line = read.lines.find((item) => item.from === from);
    return line === undefined ? 'no line' : lineText(line);
  };
  for (const name of plan.names) addRow(context, plan.step, { check: `DNS lookup of ${name} in the job`, expected: 'recorded', measured: measured(`dns:${name}`) });
  for (const target of plan.targets) {
    addRow(context, plan.step, { check: `GET ${target.url} in the job (${target.from})`, expected: 'recorded; one request at least answers 200 with ok', measured: measured(target.from) });
  }
  return read.lines;
}

export function job(context: ProbeContext): Promise<string> {
  const address = addressOf(context);
  const targets = healthTargets(address.slug, address.url);
  return runJob(context, { step: 'Job', on: 'web', program: healthProgram(targets, context.run), names: [], targets, decides: EACH_REQUEST });
}

export async function runJob(context: ProbeContext, plan: JobPlan): Promise<string> {
  const serviceId = serviceIdOf(sessionOf(context, plan.on));
  if (plan.settleMs !== undefined) {
    progress(`waiting ${seconds(plan.settleMs)} before the job`);
    await sleep(plan.settleMs, context.signal);
    addRow(context, plan.step, { check: 'Wait before the job', expected: 'recorded', measured: seconds(plan.settleMs) });
  }
  const command = startCommand(plan.program);
  context.report.startCommand = command;
  const created = await createJob(context, { ...plan, serviceId }, command);
  const ended = await waitForEnd(context, { ...plan, serviceId }, created);
  const createdAt = Date.parse(ended.createdAt ?? '');
  const since = { createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - 600_000, targets: plan.targets.length + plan.names.length };
  // The lines of a job carry the job ID as their resource, not the ID of its service (development run of SO-01d).
  const lines = recordLines(context, plan, await readProbeLines(context, [serviceId, ended.id], since));
  assert.ok(lines.length > 0, `The logs of ${serviceId} and ${ended.id} hold no line of this run (the job ended ${shown(ended.status)}). The job may not have run the start command.`);
  const passed = (line: ProbeLine): boolean => lineOk(line) && plan.decides(line);
  const ok = lines.filter(passed).map((line) => line.from);
  const failed = lines.filter((line) => !passed(line)).map((line) => `${line.from}: ${lineText(line)}`);
  assert.ok(ok.length > 0, `No deciding request of the job answered 200 with ok: ${failed.join('; ')}`);
  return `the job ${ended.id} ended ${ended.status}; 200 with ok from ${ok.join(', ')}; ${failed.length === 0 ? 'no request failed' : `other answers: ${failed.join('; ')}`}.`;
}
