import assert from 'node:assert/strict';
import { fieldJson, fieldText, renderId } from '../render-tenant-lifecycle/answers.ts';
import { addRow, progress, seconds, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { poll } from '../render-tenant-lifecycle/polls.ts';
import { healthProgram, healthTargets, jobCall, jobStatusCall, startCommand, type Target } from './calls.ts';
import { addressOf, sessionOf, type ProbeContext } from './context.ts';
import { readProbeLines, transcriptOf, type LinesRead, type ProbeLine } from './job-logs.ts';

export const JOB_POLL = { everyMs: 5_000, attempts: 60 } as const;
export const JOB_ENDED = new Set(['succeeded', 'failed', 'canceled']);

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

function between(from: string | undefined, to: string | undefined): string {
  const start = Date.parse(from ?? '');
  const end = Date.parse(to ?? '');
  return Number.isFinite(start) && Number.isFinite(end) ? seconds(end - start) : 'unknown';
}

async function createJob(context: ProbeContext, webId: string, command: string): Promise<{ readonly job: JobView; readonly started: number }> {
  const started = performance.now();
  const answer = await context.client.write('Job', jobCall(webId, command), context.signal);
  assert.equal(answer.status, 201, `POST /services/${webId}/jobs answered ${answer.status}, not 201`);
  const job = jobOf(answer.json);
  context.state.job = { id: job.id, status: job.status };
  progress(`started the job ${job.id} on ${webId}`);
  addRow(context, 'Job', { check: 'Create answer', expected: '201 with the job', measured: `201 after ${seconds(answer.ms)}: ${job.id}, plan ${shown(job.planId)}, status ${shown(job.status)}` });
  return { job, started };
}

async function waitForEnd(context: ProbeContext, webId: string, created: { readonly job: JobView; readonly started: number }): Promise<JobView> {
  const statuses: string[] = [];
  const ended = await poll({ plan: JOB_POLL, signal: context.signal, what: `job ${created.job.id} to end` }, async () => {
    const job = jobOf((await context.client.read(jobStatusCall(webId, created.job.id), context.signal)).json);
    const status = job.status ?? 'absent';
    if (context.state.job !== undefined) context.state.job.status = status;
    if (statuses.at(-1) !== status) {
      statuses.push(status);
      progress(`job ${job.id}: ${status} after ${seconds(performance.now() - created.started)}`);
    }
    return JOB_ENDED.has(status) ? job : undefined;
  });
  const render = `Render: createdAt ${ended.createdAt ?? 'absent'}, startedAt ${ended.startedAt ?? 'absent'}, finishedAt ${ended.finishedAt ?? 'absent'}; ${between(ended.createdAt, ended.startedAt)} to start, ${between(ended.startedAt, ended.finishedAt)} to run`;
  addRow(context, 'Job', { check: 'Job end', expected: 'succeeded; times recorded', measured: `${ended.status} ${seconds(performance.now() - created.started)} after the create call (${statuses.join(' > ')}); ${render}` });
  return ended;
}

function lineText(line: ProbeLine): string {
  const ms = line.ms === undefined ? '' : `, after ${line.ms} ms`;
  if (line.status !== undefined) return `${line.status}, body ${JSON.stringify(line.body ?? '')}${ms}`;
  return `no answer: ${line.error ?? 'no error name'}, "${line.message ?? ''}"${ms}`;
}

function lineOk(line: ProbeLine): boolean {
  return line.status === 200 && line.body?.trim() === 'ok';
}

function recordLines(context: ProbeContext, targets: readonly Target[], read: LinesRead): readonly ProbeLine[] {
  const resources = [...new Set(read.lines.map((line) => line.entry.labels.resource ?? 'absent'))].join(', ') || 'none';
  addRow(context, 'Job', { check: 'Log lines of this run', expected: `${targets.length}, one for each request`, measured: `${read.lines.length} of ${read.entries} log entries, ${seconds(read.ms)} after the job end (${read.reads} reads of GET /logs with resource ${read.resources.join(' and ')}); resource labels: ${resources}` });
  context.report.transcript.push(...transcriptOf(read.lines));
  for (const target of targets) {
    const line = read.lines.find((item) => item.from === target.from);
    addRow(context, 'Job', { check: `GET ${target.url} in the job (${target.from})`, expected: 'recorded; one request at least answers 200 with ok', measured: line === undefined ? 'no line' : lineText(line) });
  }
  return read.lines;
}

export async function job(context: ProbeContext): Promise<string> {
  const address = addressOf(context);
  const webId = serviceIdOf(sessionOf(context, 'web'));
  const targets = healthTargets(address.slug, address.url);
  const command = startCommand(healthProgram(targets, context.run));
  context.report.startCommand = command;
  const created = await createJob(context, webId, command);
  const ended = await waitForEnd(context, webId, created);
  const createdAt = Date.parse(ended.createdAt ?? '');
  const since = { createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() - 600_000, targets: targets.length };
  const lines = recordLines(context, targets, await readProbeLines(context, [webId], since));
  assert.ok(lines.length > 0, `The logs of ${webId} hold no line of this run (job ${ended.id} ended ${shown(ended.status)}). The job may not have run the start command, or its lines went to another resource.`);
  const ok = lines.filter(lineOk).map((line) => line.from);
  const failed = lines.filter((line) => !lineOk(line)).map((line) => `${line.from}: ${lineText(line)}`);
  assert.ok(ok.length > 0, `No request of the job answered 200 with ok: ${failed.join('; ')}`);
  return `the job ${ended.id} ended ${ended.status}; 200 with ok from ${ok.join(', ')}; ${failed.length === 0 ? 'no request failed' : `other answers: ${failed.join('; ')}`}.`;
}
