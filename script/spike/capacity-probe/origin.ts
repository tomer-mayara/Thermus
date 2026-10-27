import assert from 'node:assert/strict';
import { createServiceCall, type Call } from '../render-tenant-lifecycle/calls.ts';
import { addRow, seconds } from '../render-tenant-lifecycle/context.ts';
import { serviceLine, type ProbeContext } from './context.ts';
import { PAGES, PAGES_IMAGE, pagesCommand, type PageSpec } from './pages.ts';
import { healthFromHere, liveService, readOrigin, STEP_OF } from './services.ts';

const STEP = STEP_OF.pages;
const PAGE_TIMEOUT_MS = 60_000;
const PAGES_DIGEST = PAGES_IMAGE.slice(PAGES_IMAGE.indexOf('@') + 1);

// A public image needs no registry credential, and the pages need no variable.
export function pagesCreateCall(source: { readonly owner: string; readonly region: string }, name: string): Call {
  const pages = { owner: source.owner, region: source.region, image: { ref: PAGES_IMAGE }, serviceType: 'web_service' as const, variables: [], dockerCommand: pagesCommand() };
  return createServiceCall(pages, name, undefined);
}

// The pages are requested as the renderer of the tenant requests them: over the public internet, by their URL.
async function checkPage(context: ProbeContext, origin: string, spec: PageSpec): Promise<string> {
  const url = `${origin}${spec.path}`;
  const started = performance.now();
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([context.signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]) });
  const body = Buffer.from(await response.arrayBuffer());
  const marker = body.toString('utf8').includes(spec.marker);
  const expected = `200, ${spec.bytes} bytes, marker ${spec.markerInHtml ? 'in' : 'not in'} the HTML`;
  const measured = `${response.status}, ${body.length} bytes, marker ${marker ? 'in' : 'not in'} the HTML, after ${seconds(performance.now() - started)}`;
  addRow(context, STEP, { check: `GET ${url} from this machine`, expected, measured });
  assert.equal(response.status, 200, `GET ${url} answered ${response.status}, not 200`);
  assert.equal(body.length, spec.bytes, `GET ${url} gave ${body.length} bytes, not ${spec.bytes}`);
  assert.equal(marker, spec.markerInHtml, `The marker of ${url} is ${marker ? '' : 'not '}in the HTML`);
  return `${spec.path} (${body.length} bytes)`;
}

export async function setupPages(context: ProbeContext): Promise<string> {
  const state = context.state.services.pages;
  const { note } = await liveService(context, 'pages', { call: () => pagesCreateCall(context.inputs, state.name), digest: PAGES_DIGEST });
  const origin = await readOrigin(context, 'pages');
  const health = await healthFromHere(context, 'pages');
  assert.ok(health.ok, `GET ${origin}/healthz from this machine gave ${health.text}, not 200 with body ok`);
  const pages = [await checkPage(context, origin, PAGES.page9m), await checkPage(context, origin, PAGES.js)];
  return `${serviceLine(state)} ${note}; ${origin}/healthz answered 200 with ok, and ${pages.join(' and ')} answered 200 with the planned sizes and markers.`;
}
