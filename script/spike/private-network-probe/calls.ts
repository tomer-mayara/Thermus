import { HEALTH_CHECK_PATH, LISTEN_PORT, PAGE_SIZE, type Call } from '../render-tenant-lifecycle/calls.ts';

// Render routes private network traffic on port 10000 to the primary HTTP server of a web service
// (render.com/docs/private-network). The API gives the internal address of a private service with this port too.
export const RENDER_PRIVATE_PORT = 10000;
export const REQUEST_TIMEOUT_MS = 5_000;
export const PROBE_MARK = 'SO-01d';

export interface Target {
  readonly from: string;
  readonly url: string;
}

export interface LogWindow {
  readonly startTime: string;
  readonly endTime: string;
}

export function jobCall(serviceId: string, startCommand: string): Call {
  return { method: 'POST', path: `/services/${serviceId}/jobs`, body: { startCommand } };
}

export function jobStatusCall(serviceId: string, jobId: string): Call {
  return { method: 'GET', path: `/services/${serviceId}/jobs/${jobId}` };
}

export function cancelJobCall(serviceId: string, jobId: string): Call {
  return { method: 'POST', path: `/services/${serviceId}/jobs/${jobId}/cancel` };
}

// The resource parameter is an array without a style in the OpenAPI document, so each value is its own parameter.
export function logsCall(owner: string, resources: readonly string[], window: LogWindow): Call {
  const query = new URLSearchParams({ ownerId: owner });
  for (const resource of resources) query.append('resource', resource);
  query.set('startTime', window.startTime);
  query.set('endTime', window.endTime);
  query.set('direction', 'forward');
  query.set('limit', String(PAGE_SIZE));
  return { method: 'GET', path: `/logs?${query}` };
}

// slug and url come from the API answer; the address step accepts only [a-z0-9-] names and a port.
export function healthTargets(slug: string, url: string): readonly Target[] {
  const verbatim = /^https?:\/\//.test(url) ? url : `http://${url}`;
  return [
    { from: `slug:${RENDER_PRIVATE_PORT}`, url: `http://${slug}:${RENDER_PRIVATE_PORT}${HEALTH_CHECK_PATH}` },
    { from: `slug:${LISTEN_PORT}`, url: `http://${slug}:${LISTEN_PORT}${HEALTH_CHECK_PATH}` },
    { from: 'serviceDetails.url', url: `${verbatim.replace(/\/$/, '')}${HEALTH_CHECK_PATH}` },
  ];
}

// SO-03: the private address of the control plane, a web service. The server of the image listens on LISTEN_PORT;
// the Private Network page routes port 10000 of a web service to its primary HTTP server. Two controls: the own
// private service of the job on LISTEN_PORT, and the public URL of the web service.
export function controlPlaneTargets(web: { readonly slug: string; readonly publicUrl: string }, privateSlug: string): readonly Target[] {
  return [
    { from: `own:${LISTEN_PORT}`, url: `http://${privateSlug}:${LISTEN_PORT}${HEALTH_CHECK_PATH}` },
    { from: `control-plane:${LISTEN_PORT}`, url: `http://${web.slug}:${LISTEN_PORT}${HEALTH_CHECK_PATH}` },
    { from: `control-plane:${RENDER_PRIVATE_PORT}`, url: `http://${web.slug}:${RENDER_PRIVATE_PORT}${HEALTH_CHECK_PATH}` },
    { from: 'control-plane:public', url: `${web.publicUrl.replace(/\/$/, '')}${HEALTH_CHECK_PATH}` },
  ];
}

// The docs do not say whether Render runs a start command through a shell. Without quotes, backslashes, dollar
// signs, and backticks, the single-quoted program reaches node -e the same way through a shell or a word split.
export function healthProgram(targets: readonly Target[], run: string): string {
  return checkedProgram([targetList(targets), '(async()=>{', requestLoop(run), '})()'].join(''));
}

// SO-03: the DNS answers of the names first, as lines with status 0 and the addresses as the body, then the requests.
export function lookupAndHealthProgram(names: readonly string[], targets: readonly Target[], run: string): string {
  const mark = probeMark(run);
  return checkedProgram([
    targetList(targets), `const names=${JSON.stringify(names)};`,
    '(async()=>{for(const name of names){const started=Date.now();',
    'try{const found=await require("node:dns").promises.lookup(name,{all:true});',
    `console.log(JSON.stringify({${mark},from:"dns:"+name,url:name,status:0,body:found.map((entry)=>entry.address).join(" "),ms:Date.now()-started}))}`,
    `catch(error){console.log(JSON.stringify({${mark},from:"dns:"+name,url:name,error:error.code||error.name,message:String(error.message).slice(0,200),ms:Date.now()-started}))}}`,
    requestLoop(run), '})()',
  ].join(''));
}

function probeMark(run: string): string {
  return `probe:"${PROBE_MARK}",run:"${run}"`;
}

function targetList(targets: readonly Target[]): string {
  return `const targets=${JSON.stringify(targets.map((target) => [target.from, target.url]))};`;
}

function requestLoop(run: string): string {
  const mark = probeMark(run);
  return [
    'for(const [from,url] of targets){const started=Date.now();',
    `try{const response=await fetch(url,{signal:AbortSignal.timeout(${REQUEST_TIMEOUT_MS})});`,
    `console.log(JSON.stringify({${mark},from,url,status:response.status,body:(await response.text()).slice(0,100),ms:Date.now()-started}))}`,
    'catch(error){const cause=error.cause||{};',
    `console.log(JSON.stringify({${mark},from,url,error:cause.code||error.name,message:String(cause.message||error.message).slice(0,200),ms:Date.now()-started}))}}`,
  ].join('');
}

function checkedProgram(program: string): string {
  if (/['\\$`\n]/.test(program)) throw new Error('The health program must not contain a quote, backslash, dollar sign, backtick, or new line.');
  return program;
}

export function startCommand(program: string): string {
  return `node -e '${program}'`;
}
