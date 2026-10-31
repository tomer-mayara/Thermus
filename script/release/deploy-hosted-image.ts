#!/usr/bin/env node
// SO-02 of the self on-boarding plan: the deploy job of .github/workflows/hosted-image.yml runs this script.
// `check` checks the deploy request of a manual dispatch and makes no network call. `deploy` checks it again, deploys
// one pushed digest of the hosted image to one Render web service through the Render API deploy with imageUrl, waits
// until the deploy is live, and requests /healthz on the public URL of the service. The API deploy with imageUrl keeps
// the image setting imagePath of the service current; after a deploy hook with imgURL, later deploys keep the image of
// the service settings (SO-01c in docs/implementation/self-onboarding-s1.md), so the workflow uses no deploy hook. The
// script reads RENDER_API_KEY from the environment and never prints it.
import { appendFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { IMAGE, parseDeployRequest, type DeployRequest } from './deploy-request.ts';
import { checkHealth, publicOrigin } from './public-health.ts';
import { deployOf, itemsOf, repositoryOf, sameDigest, serviceOf, shown, type DeployView, type ServiceView } from './render-answers.ts';
import { messageOf, RenderApi } from './render-api.ts';

const WORKSPACE_ID = 'tea-db8i6ceq1p3s73dev9og';
const ENDED = new Set(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated']);
const DEPLOY_WAIT = { everyMs: 5_000, reads: 180 };
const LIST_WAIT = { everyMs: 5_000, reads: 12 };

const USAGE = [
  'Usage: node script/release/deploy-hosted-image.ts check|deploy',
  'The deploy job of .github/workflows/hosted-image.yml runs it. It reads DIGEST, SERVICE_ID, CONFIRM_PRODUCTION, and',
  'GITHUB_REF from the environment; deploy also reads RENDER_API_KEY and writes GITHUB_STEP_SUMMARY.',
  '',
].join('\n');

interface ServiceRule {
  readonly holds: (service: ServiceView) => boolean;
  readonly problem: (service: ServiceView) => string;
}

const SERVICE_RULES: readonly ServiceRule[] = [
  {
    holds: (service) => service.ownerId === WORKSPACE_ID,
    problem: (service) => `The service is in the workspace ${shown(service.ownerId)}, not in Thermus AI, ${WORKSPACE_ID}.`,
  },
  {
    holds: (service) => service.type === 'web_service',
    problem: (service) => `The service is a ${shown(service.type)}, not a web service. The fleet script of SO-09 deploys the tenants.`,
  },
  {
    holds: (service) => service.runtime === 'image',
    problem: (service) => `The runtime of the service is ${shown(service.runtime)}, not image: the service does not run a prebuilt image.`,
  },
  {
    holds: (service) => repositoryOf(service.imagePath) === IMAGE,
    problem: (service) => `The image setting of the service is ${shown(service.imagePath)}, not an image of ${IMAGE}. A deploy with imageUrl must keep the host, the repository, and the image name.`,
  },
  {
    holds: (service) => service.suspended === 'not_suspended',
    problem: (service) => `The service is ${shown(service.suspended)}, not running. Resume it first.`,
  },
];

class Report {
  readonly #rows: (readonly [string, string])[] = [];

  public add(item: string, value: string): void {
    this.#rows.push([item, value]);
  }

  public write(title: string): void {
    const rows = this.#rows.map(([item, value]) => `| ${item} | ${value.replaceAll('|', '\\|')} |`);
    const text = [`### ${title}`, '', '| Item | Value |', '| --- | --- |', ...rows, ''].join('\n');
    process.stdout.write(`${text}\n`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary !== undefined && summary !== '') appendFileSync(summary, `${text}\n`);
  }
}

function seconds(ms: number): string {
  return `${(ms / 1_000).toFixed(1)} s`;
}

function progress(line: string): void {
  process.stdout.write(`${line}\n`);
}

// A workflow command ends at a line break, so a message keeps its line breaks and percent signs escaped.
function annotate(message: string): string {
  return `::error::${message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}\n`;
}

async function deployIds(api: RenderApi, serviceId: string): Promise<ReadonlySet<string>> {
  const deploys = itemsOf(await api.read(`/services/${serviceId}/deploys?limit=20`), 'deploy');
  return new Set(deploys.map((deploy) => deployOf(deploy).id));
}

// A 202 answer has no body, so the new deploy comes from the deploy list.
async function startDeploy(api: RenderApi, request: DeployRequest): Promise<string> {
  const known = await deployIds(api, request.serviceId);
  const path = `/services/${request.serviceId}/deploys`;
  const answer = await api.post(path, { imageUrl: request.imageUrl });
  if (answer.status === 201 && deployOf(answer.json).id !== '') return deployOf(answer.json).id;
  if (answer.status !== 202) throw new Error(`POST ${path} answered ${answer.status} with no deploy ID, not 201 with the deploy or 202.`);
  for (let read = 1; read <= LIST_WAIT.reads; read++) {
    const fresh = [...await deployIds(api, request.serviceId)].find((id) => !known.has(id));
    if (fresh !== undefined) return fresh;
    await sleep(LIST_WAIT.everyMs);
  }
  throw new Error(`POST ${path} answered 202, and the deploy list showed no new deploy after ${LIST_WAIT.reads} reads.`);
}

async function waitForLive(api: RenderApi, serviceId: string, deployId: string): Promise<{ readonly deploy: DeployView; readonly statuses: readonly string[] }> {
  const statuses: string[] = [];
  for (let read = 1; read <= DEPLOY_WAIT.reads; read++) {
    const deploy = deployOf(await api.read(`/services/${serviceId}/deploys/${deployId}`));
    const status = deploy.status ?? 'absent';
    if (statuses.at(-1) !== status) {
      statuses.push(status);
      progress(`Deploy ${deployId}: ${status}.`);
    }
    if (status === 'live') return { deploy, statuses };
    if (ENDED.has(status)) throw new Error(`The deploy ${deployId} ended as ${status} (${statuses.join(' > ')}).`);
    await sleep(DEPLOY_WAIT.everyMs);
  }
  throw new Error(`The deploy ${deployId} was not live after ${DEPLOY_WAIT.reads} reads, ${seconds(DEPLOY_WAIT.everyMs)} apart (${statuses.join(' > ')}).`);
}

function imageProblems(request: DeployRequest, deploy: DeployView, service: ServiceView): readonly string[] {
  const problems: string[] = [];
  if (!sameDigest(deploy.imageSha, request.digest)) problems.push(`The live deploy reports the image ${shown(deploy.imageSha)}, not ${request.digest}.`);
  if (service.imagePath !== request.imageUrl) problems.push(`The image setting imagePath of the service is ${shown(service.imagePath)}, not ${request.imageUrl}.`);
  return problems;
}

async function deploy(api: RenderApi, request: DeployRequest, report: Report): Promise<void> {
  const before = serviceOf(await api.read(`/services/${request.serviceId}`));
  report.add('Service name', shown(before.name));
  report.add('Image before', `\`${shown(before.imagePath)}\``);
  const problems = SERVICE_RULES.filter((rule) => !rule.holds(before)).map((rule) => rule.problem(before));
  if (problems.length > 0) throw new Error(problems.join(' '));
  const started = performance.now();
  const deployId = await startDeploy(api, request);
  report.add('Deploy ID', `\`${deployId}\``);
  progress(`Started the deploy ${deployId} of ${request.imageUrl} on ${shown(before.name)}.`);
  const live = await waitForLive(api, request.serviceId, deployId);
  const render = `Render: createdAt ${shown(live.deploy.createdAt)}, finishedAt ${shown(live.deploy.finishedAt)}`;
  report.add('Deploy', `${live.statuses.join(' > ')}; live ${seconds(performance.now() - started)} after the deploy call; ${render}`);
  const after = serviceOf(await api.read(`/services/${request.serviceId}`));
  const mismatches = imageProblems(request, live.deploy, after);
  if (mismatches.length > 0) throw new Error(mismatches.join(' '));
  report.add('Image after', `\`${request.imageUrl}\`, in the live deploy and in imagePath of the service`);
  report.add('Health', await checkHealth(await publicOrigin(api, after)));
}

async function deployAndReport(request: DeployRequest): Promise<number> {
  const report = new Report();
  report.add('Service ID', `\`${request.serviceId}\``);
  report.add('Image to deploy', `\`${request.imageUrl}\``);
  try {
    const key = process.env.RENDER_API_KEY ?? '';
    if (key === '') throw new Error('RENDER_API_KEY is empty. The deploy job reads it from the secret RENDER_API_KEY of the GitHub environment production.');
    await deploy(new RenderApi(key), request, report);
    report.write('Deploy: live');
    return 0;
  } catch (error) {
    report.add('Failure', messageOf(error));
    report.write('Deploy: failed');
    process.stdout.write(annotate(messageOf(error)));
    return 1;
  }
}

async function main(mode: string | undefined): Promise<number> {
  if (mode !== 'check' && mode !== 'deploy') {
    process.stderr.write(USAGE);
    return 2;
  }
  const parsed = parseDeployRequest(process.env);
  if (parsed.request === undefined) {
    for (const problem of parsed.problems) process.stdout.write(annotate(problem));
    return 1;
  }
  if (mode === 'deploy') return deployAndReport(parsed.request);
  progress(`The deploy request is valid: ${parsed.request.imageUrl} to ${parsed.request.serviceId}.`);
  return 0;
}

process.exitCode = await main(process.argv[2]);
