import assert from 'node:assert/strict';
import { HEALTH_CHECK_PATH, serviceCall } from '../render-tenant-lifecycle/calls.ts';
import { serviceOf } from '../render-tenant-lifecycle/answers.ts';
import { addRow, serviceIdOf, shown } from '../render-tenant-lifecycle/context.ts';
import { RENDER_PRIVATE_PORT, REQUEST_TIMEOUT_MS } from './calls.ts';
import { addressOf, sessionOf, type ProbeContext } from './context.ts';
import { lookupHere, outcomeText, requestHere } from './here.ts';

const STEP = 'Public check';
const PUBLIC_DOMAIN = /onrender\.com/i;

// Only onrender.com counts: each answer also has dashboardUrl, an https URL of dashboard.render.com.
function publicFields(value: unknown, path = 'service'): readonly string[] {
  if (typeof value === 'string') return PUBLIC_DOMAIN.test(value) ? [`${path} ${value}`] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => publicFields(item, `${path}[${index}]`));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => publicFields(item, `${path}.${key}`));
}

async function recordRenderDomain(context: ProbeContext, slug: string): Promise<void> {
  const host = `${slug}.onrender.com`;
  const lookup = await lookupHere(host);
  let measured = `DNS fails: ${lookup.address === undefined ? lookup.code : ''}`;
  if (lookup.address !== undefined) {
    const outcome = await requestHere(`https://${host}${HEALTH_CHECK_PATH}`, REQUEST_TIMEOUT_MS, context.signal);
    measured = `DNS resolves to ${lookup.address}; GET ${outcome.status === undefined ? `gets no answer: ${outcome.error}` : `answers ${outcome.status}`}`;
  }
  addRow(context, STEP, { check: `https://${host}${HEALTH_CHECK_PATH} from this machine (extra)`, expected: 'recorded', measured });
}

export async function publicCheck(context: ProbeContext): Promise<string> {
  const { slug } = addressOf(context);
  const lookup = await lookupHere(slug);
  addRow(context, STEP, { check: `DNS lookup of ${slug} from this machine`, expected: 'fails', measured: lookup.address === undefined ? `fails: ${lookup.code}` : `resolves to ${lookup.address}` });
  const url = `http://${slug}:${RENDER_PRIVATE_PORT}${HEALTH_CHECK_PATH}`;
  const outcome = await requestHere(url, REQUEST_TIMEOUT_MS, context.signal);
  addRow(context, STEP, { check: `GET ${url} from this machine`, expected: 'no answer', measured: outcomeText(outcome) });
  const answer = await context.client.read(serviceCall(serviceIdOf(sessionOf(context, 'private'))), context.signal);
  const address = serviceOf(answer.json).url ?? '';
  const fields = publicFields(answer.json);
  addRow(context, STEP, { check: 'Public URL in the private service answer', expected: 'none: serviceDetails.url has no scheme, and no field names onrender.com', measured: `serviceDetails.url ${shown(address)}; ${fields.length === 0 ? 'no field names onrender.com' : fields.join('; ')}` });
  await recordRenderDomain(context, slug);
  assert.ok(lookup.address === undefined, `${slug} resolves to ${lookup.address} from this machine`);
  assert.ok(outcome.status === undefined, `GET ${url} from this machine answered ${outcome.status}`);
  assert.ok(!/^https?:\/\//i.test(address), `serviceDetails.url of the private service is ${address}, a URL with a scheme`);
  assert.deepEqual(fields, [], `The private service answer names the public Render domain: ${fields.join('; ')}`);
  const code = lookup.address === undefined ? lookup.code : 'none';
  return `from this machine, ${slug} does not resolve (${code}), GET ${url} gets no answer (${outcome.status === undefined ? outcome.error : 'answered'}), and the private service answer holds no public URL.`;
}
