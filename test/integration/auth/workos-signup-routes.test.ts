import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { BrowserSession, BrowserSessionState } from '../../../src/auth/hosted-auth/browser-session.ts';
import { WorkOSSignupRoutes } from '../../../src/auth/hosted-auth/workos/workos-signup-routes.ts';
import type { SignupActivation, SignupDocuments } from '../../../src/auth/hosted-auth/workos/workos-signup.ts';

const document = (text: string) => ({ version: 'v1', text, sha256: createHash('sha256').update(text).digest('hex') });
const documents: SignupDocuments = { version: 'v1', terms: document('Test <terms>'), notice: document('Test <notice>'), agreement: { version: 'v1', text: 'I agree as an adult for business use.' } };

function setup(enabled = true, signedIn = true) {
  let calls = 0;
  let sessions = 0;
  const failures: string[] = [];
  const state: BrowserSessionState = signedIn ? { status: 'signed-in', user: { authority: 'workos:test', subject: 'user_test' }, csrfToken: 'secret', mfaCompleted: false,
    cookies: ['renewed=session; Secure'], selectOrganization: async () => { throw new Error('No switch'); } } : { status: 'signed-out', cookies: [] };
  const session: BrowserSession = { authenticate: async () => { sessions++; return state; } };
  const activation: SignupActivation = { activate: async () => { calls++; return { status: 'active', organizationId: 'org_new' }; } };
  const routes = new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled, documents, session, activation, reportFailure: (message) => failures.push(message) });
  return { routes, activation, session, failures, calls: () => calls, sessions: () => sessions };
}

function post(body = 'csrf_token=secret&document_version=v1&agreement=accepted', origin = 'https://thermus.example'): Request {
  return new Request('https://thermus.example/signup', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

test('Given closed signup, when GET or POST arrives, then it does no session or activation work', async () => {
  const world = setup(false);
  assert.equal((await world.routes.handle(new Request('https://thermus.example/signup'))).status, 200);
  assert.equal((await world.routes.handle(post())).status, 403);
  assert.equal(world.calls(), 0);
  assert.equal(world.sessions(), 0);
});

test('Given enabled signup without approved documents, when composed, then startup fails', () => {
  const world = setup();
  assert.throws(() => new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, session: world.session, activation: world.activation, reportFailure: () => {} }));
});

test('Given signed-out signup, when opened, then the full escaped notice appears before sign-in', async () => {
  const world = setup(true, false);
  const answer = await world.routes.handle(new Request('https://thermus.example/signup'));
  const html = await answer.text();
  assert.match(html, /Test &lt;notice&gt;/);
  assert.match(html, /login\?return_to=%2Fsignup/);
  assert.ok(html.indexOf('Test &lt;notice&gt;') < html.indexOf('Sign in'));
});

test('Given signed-in signup, when opened then posted with express agreement, then it redirects to organizations and keeps session cookies', async () => {
  const world = setup();
  const form = await (await world.routes.handle(new Request('https://thermus.example/signup'))).text();
  assert.match(form, /type="checkbox" name="agreement" value="accepted" required/);
  assert.doesNotMatch(form, /checked|return_to/);
  assert.match(form, /Test &lt;terms&gt;/);
  const answer = await world.routes.handle(post());
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/organizations');
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
  assert.equal(world.calls(), 1);
});

test('Given forged or stale signup, when posted, then no activation runs', async () => {
  const world = setup();
  assert.equal((await world.routes.handle(post(undefined, 'https://other.example'))).status, 403);
  assert.equal(world.sessions(), 0);
  assert.equal((await world.routes.handle(post('csrf_token=secret&document_version=old&agreement=accepted'))).status, 400);
  assert.equal(world.calls(), 0);
});

test('Given signup HEAD, when handled, then the response has no body and no session or activation work', async () => {
  const world = setup();
  const answer = await world.routes.handle(new Request('https://thermus.example/signup', { method: 'HEAD' }));
  assert.equal(await answer.text(), '');
  assert.equal(world.sessions(), 0);
  assert.equal(world.calls(), 0);
});

test('Given an activation outage after session refresh, when posted, then the cookie survives and logs contain only fixed text', async () => {
  const world = setup();
  world.activation.activate = async () => { throw new Error('secret provider body'); };
  const answer = await world.routes.handle(post());
  assert.equal(answer.status, 503);
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
  assert.deepEqual(world.failures, ['Hosted signup request failed.']);
  assert.doesNotMatch(await answer.text(), /secret/);
});

test('Given activation requires support, when posted, then a conflict page offers Contact and does not retry activation', async () => {
  const world = setup();
  let calls = 0;
  world.activation.activate = async () => { calls++; return { status: 'support-required' }; };
  const answer = await world.routes.handle(post());
  assert.equal(answer.status, 409);
  assert.match(await answer.text(), /<a href="mailto:legal@thermus.ai">Contact<\/a>/);
  assert.equal(calls, 1);
});

test('Given repeated activation posts, when the per-subject limit is reached, then further activation work is refused', async () => {
  const world = setup();
  for (let index = 0; index < 3; index++) assert.equal((await world.routes.handle(post())).status, 303);
  const refused = await world.routes.handle(post());
  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get('Retry-After'), '60');
  assert.equal(world.calls(), 3);
});

test('Given eight concurrent activation requests, when another POST arrives, then admission refuses it before session work', async () => {
  const world = setup();
  const pending: Array<(state: BrowserSessionState) => void> = [];
  world.session.authenticate = () => new Promise((resolve) => pending.push(resolve));
  const requests = Array.from({ length: 8 }, () => world.routes.handle(post()));
  assert.equal((await world.routes.handle(post())).status, 429);
  assert.equal(pending.length, 8);
  for (const resolve of pending) resolve({ status: 'signed-out', cookies: [] });
  await Promise.all(requests);
  world.session.authenticate = async () => ({ status: 'signed-out', cookies: [] });
  assert.equal((await world.routes.handle(post())).status, 401);
});

test('Given an oversized agreement form, when posted, then bounded reading refuses it without activation', async () => {
  const world = setup();
  assert.equal((await world.routes.handle(post('x'.repeat(16 * 1024 + 1)))).status, 413);
  assert.equal(world.calls(), 0);
});

test('Given a cancelled session lookup, when it later succeeds, then no activation starts', async () => {
  const world = setup();
  let complete!: (state: BrowserSessionState) => void;
  world.session.authenticate = () => new Promise((resolve) => { complete = resolve; });
  const cancellation = new AbortController();
  const request = new Request(post(), { signal: cancellation.signal });
  const answer = world.routes.handle(request);
  cancellation.abort(new Error('cancelled'));
  await assert.rejects(answer, /cancelled/);
  complete({ status: 'signed-out', cookies: [] });
  assert.equal(world.calls(), 0);
});

test('Given cancelled requests with provider lookups still running, when another post arrives, then the outstanding work still holds admission slots', async () => {
  const world = setup();
  const completions: Array<(state: BrowserSessionState) => void> = [];
  world.session.authenticate = () => new Promise((resolve) => completions.push(resolve));
  for (let index = 0; index < 8; index++) {
    const cancellation = new AbortController();
    const answer = world.routes.handle(new Request(post(), { signal: cancellation.signal }));
    cancellation.abort(new Error('cancelled'));
    await assert.rejects(answer, /cancelled/);
  }
  assert.equal((await world.routes.handle(post())).status, 429);
  for (const complete of completions) complete({ status: 'signed-out', cookies: [] });
});

test('Given a full subject limiter, when a new subject posts, then it is refused until old entries expire', async () => {
  let subject = 'user_0';
  let time = 0;
  let activations = 0;
  const session: BrowserSession = { authenticate: async () => ({ status: 'signed-in', user: { authority: 'workos:test', subject }, csrfToken: 'secret', mfaCompleted: false,
    cookies: [], selectOrganization: async () => { throw new Error('No switch'); } }) };
  const activation: SignupActivation = { activate: async () => { activations++; return { status: 'existing-access' }; } };
  const routes = new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, documents, session, activation, reportFailure: () => {}, clock: () => time });
  for (let index = 0; index < 1024; index++) {
    subject = `user_${index}`;
    assert.equal((await routes.handle(post())).status, 303);
  }
  subject = 'user_overflow';
  assert.equal((await routes.handle(post())).status, 429);
  assert.equal(activations, 1024);
  time = 60_000;
  assert.equal((await routes.handle(post())).status, 303);
});
