import { setTimeout as sleep } from 'node:timers/promises';
import { itemsOf, shown, textOf, type ServiceView } from './render-answers.ts';
import { messageOf, type RenderApi } from './render-api.ts';

// A new web service answered 502 one time after its deploy was live, and 200 5 s later (SO-01d part two in
// docs/implementation/self-onboarding-s1.md). So the check repeats its request after a 502, and only then.
const HEALTH = { everyMs: 5_000, attempts: 6, timeoutMs: 10_000, bodyLimit: 100 };
const DOMAIN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const RENDER_URL = /^https:\/\/[a-z0-9.-]+\/?$/;

// The production service answers only on its custom domain, app.thermus.ai: its onrender.com subdomain is off. A
// domain that redirects to another name is not the public URL.
export async function publicOrigin(api: RenderApi, service: ServiceView): Promise<string> {
  const domains = itemsOf(await api.read(`/services/${service.id}/custom-domains?verificationStatus=verified&limit=20`), 'customDomain');
  const [name] = domains
    .filter((domain) => domain.verificationStatus === 'verified' && (textOf(domain.redirectForName) ?? '') === '')
    .map((domain) => textOf(domain.name) ?? '')
    .filter((value) => DOMAIN.test(value))
    .sort();
  if (name !== undefined) return `https://${name}`;
  if (service.url !== undefined && RENDER_URL.test(service.url)) return service.url;
  throw new Error(`The service ${service.id} has no verified custom domain and no https URL; serviceDetails.url is ${shown(service.url)}.`);
}

async function requestHealth(url: string): Promise<{ readonly ok: boolean; readonly status?: number; readonly text: string }> {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(HEALTH.timeoutMs) });
    const body = (await response.text()).slice(0, HEALTH.bodyLimit);
    return { ok: response.status === 200 && body.trim() === 'ok', status: response.status, text: `${response.status} ${JSON.stringify(body)}` };
  } catch (error) {
    return { ok: false, text: `no answer (${messageOf(error)})` };
  }
}

export async function checkHealth(origin: string): Promise<string> {
  const url = new URL('/healthz', origin).href;
  const answers: string[] = [];
  for (let attempt = 1; attempt <= HEALTH.attempts; attempt++) {
    const answer = await requestHealth(url);
    if (answer.ok) {
      const earlier = answers.length === 0 ? '' : `; the requests before it: ${answers.join(', ')}`;
      return `GET ${url} answered 200 with ok at request ${attempt} of at most ${HEALTH.attempts}${earlier}`;
    }
    answers.push(answer.text);
    if (answer.status !== 502) break;
    if (attempt < HEALTH.attempts) await sleep(HEALTH.everyMs);
  }
  throw new Error(`GET ${url} did not answer 200 with ok: ${answers.join(', ')}.`);
}
