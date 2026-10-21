import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { BrowserSession, BrowserSessionState } from '../../../src/accounts/identity/browser-session.ts';
import { WorkOSSignupRoutes } from '../../../src/interfaces/web/auth/workos/workos-signup-routes.ts';
import type { SignupActivation, SignupDocuments } from '../../../src/accounts/providers/workos/workos-signup.ts';

const document = (text: string) => ({ version: 'v1', text, sha256: createHash('sha256').update(text).digest('hex') });
const documents: SignupDocuments = { version: 'v1', terms: document('Test <terms>'), notice: document('Test <notice>'), agreement: { version: 'v1', text: 'I agree as an adult for business use.' } };

function setup(enabled = true, signedIn = true, publicBaseUrl = 'https://thermus.example/') {
  let calls = 0;
  let inspections = 0;
  let sessions = 0;
  const failures: string[] = [];
  const state: BrowserSessionState = signedIn ? { status: 'signed-in', user: { authority: 'workos:test', subject: 'user_test' }, csrfToken: 'secret', mfaCompleted: false,
    cookies: ['renewed=session; Secure'], selectOrganization: async () => { throw new Error('No switch'); } } : { status: 'signed-out', cookies: [] };
  const session: BrowserSession = { authenticate: async () => { sessions++; return state; } };
  const activation: SignupActivation = { inspect: async () => { inspections++; return { status: 'eligible' }; }, activate: async () => { calls++; return { status: 'active', organizationId: 'org_new' }; } };
  const routes = new WorkOSSignupRoutes({ publicBaseUrl, enabled, documents, session, activation, reportFailure: (message) => failures.push(message) });
  return { routes, activation, session, failures, calls: () => calls, sessions: () => sessions, inspections: () => inspections };
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
  assert.equal(world.inspections(), 0);
});

test('Given enabled signup without approved documents, when composed, then startup fails', () => {
  const world = setup();
  assert.throws(() => new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, session: world.session, activation: world.activation, reportFailure: () => {} }));
});

test('Given signed-out signup, when opened, then the full escaped notice appears before the sign-in action', async () => {
  const world = setup(true, false);
  const answer = await world.routes.handle(new Request('https://thermus.example/signup'));
  const html = await answer.text();
  assert.match(html, /Test &lt;notice&gt;/);
  assert.match(html, /login\?return_to=%2Fsignup/);
  assert.ok(html.indexOf('Test &lt;notice&gt;') < html.indexOf('>Sign in to continue</a>'));
  assert.equal(world.inspections(), 0);
});

test('Given signed-in signup and exact fields with the current document version, when opened then posted with express agreement, then it redirects to organizations and keeps session cookies', async () => {
  const world = setup();
  const form = await (await world.routes.handle(new Request('https://thermus.example/signup'))).text();
  assert.match(form, /type="checkbox" name="agreement" value="accepted" required/);
  assert.equal(parseHTML(form).document.querySelector('input[name="agreement"]')?.hasAttribute('checked'), false);
  assert.doesNotMatch(form, /return_to/);
  assert.match(form, /Test &lt;terms&gt;/);
  const answer = await world.routes.handle(post());
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/organizations?return_to=%2F');
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
  assert.equal(world.calls(), 1);
  assert.equal(world.inspections(), 1);
});

test('Given current product access, when signup is read, then it offers Continue without agreement or activation and preserves refreshed cookies', async () => {
  const world = setup();
  world.activation.inspect = async () => ({ status: 'existing-access' });
  const answer = await world.routes.handle(new Request('https://thermus.example/signup?return_to=https://other.example/'));
  assert.equal(answer.status, 200);
  const html = await answer.text();
  assert.match(html, /<a[^>]* href="\/organizations\?return_to=%2F">Continue<\/a>/);
  assert.doesNotMatch(html, /checkbox|Test &lt;terms&gt;|other\.example/);
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
  assert.equal(world.calls(), 0);
});

for (const canContinue of [false, true]) {
  test(`Given a retained activation needs support and other access is ${canContinue}, when signup is read, then it offers support and only a current authorized continuation`, async () => {
    const world = setup();
    world.activation.inspect = async () => ({ status: 'support-required', canContinue });
    const answer = await world.routes.handle(new Request('https://thermus.example/signup'));
    assert.equal(answer.status, 409);
    const html = await answer.text();
    assert.match(html, /mailto:legal@thermus.ai/);
    assert.doesNotMatch(html, /checkbox|Activate free access/);
    assert.equal(html.includes('Continue to another workspace'), canContinue);
    if (canContinue) assert.match(html, /href="\/organizations\?return_to=%2F"/);
    assert.equal(world.calls(), 0);
  });
}

for (const failure of ['result', 'exception']) {
  test(`Given a signup inspection ${failure} is unavailable, when signup is read, then it shows no agreement and preserves refreshed cookies`, async () => {
    const world = setup();
    world.activation.inspect = async () => { if (failure === 'exception') throw new Error('provider secret'); return { status: 'unavailable' }; };
    const answer = await world.routes.handle(new Request('https://thermus.example/signup'));
    assert.equal(answer.status, 503);
    assert.doesNotMatch(await answer.text(), /checkbox|provider secret|Activate free access/);
    assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
    assert.equal(world.calls(), 0);
  });
}

test('Given a public-base path, when existing access continues or activation succeeds, then both selector destinations return to that server-owned portal path', async () => {
  const world = setup(true, true, 'https://thermus.example/app/');
  world.activation.inspect = async () => ({ status: 'existing-access' });
  const page = await world.routes.handle(new Request('https://thermus.example/app/signup?return_to=/other'));
  assert.match(await page.text(), /href="\/app\/organizations\?return_to=%2Fapp%2F"/);
  const activation = new Request('https://thermus.example/app/signup', post());
  const answer = await world.routes.handle(activation);
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/app/organizations?return_to=%2Fapp%2F');
});

test('Given unchecked, stale, forged, repeated, or extra signup fields, when posted, then the public route refuses the form without activation', async () => {
  const cases = [
    { body: 'csrf_token=secret&document_version=v1', status: 400 },
    { body: 'csrf_token=secret&document_version=old&agreement=accepted', status: 400 },
    { body: 'csrf_token=wrong&document_version=v1&agreement=accepted', status: 403 },
    { body: 'csrf_token=secret&document_version=v1&agreement=accepted&agreement=accepted', status: 400 },
    { body: 'csrf_token=secret&document_version=v1&agreement=accepted&subject=user', status: 400 },
    { body: 'csrf_token=secret&document_version=v1&agreement=false', status: 400 },
  ];
  for (const { body, status } of cases) {
    const world = setup();
    const answer = await world.routes.handle(post(body));
    assert.equal(answer.status, status, body);
    assert.equal(world.calls(), 0, body);
    assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
    assert.deepEqual(world.failures, []);
  }
});

test('Given forged or stale signup, when posted, then no activation runs', async () => {
  const world = setup();
  const forged = await world.routes.handle(post(undefined, 'https://other.example'));
  assert.equal(forged.status, 403);
  const forgedPage = parseHTML(await forged.text()).document;
  assert.equal(forgedPage.querySelector('h1')?.textContent, 'Request refused');
  assert.equal(forgedPage.querySelector('.notice-message')?.textContent, 'The form is not from this site or is no longer valid. Nothing changed.');
  assert.equal(forgedPage.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  assert.equal(forgedPage.querySelector('.primary-action')?.getAttribute('href'), '/signup');
  assert.equal(world.sessions(), 0);
  const stale = await world.routes.handle(post('csrf_token=secret&document_version=old&agreement=accepted'));
  assert.equal(stale.status, 400);
  const stalePage = parseHTML(await stale.text()).document;
  assert.equal(stalePage.querySelector('h1')?.textContent, 'Request not valid');
  assert.equal(stalePage.querySelector('.notice-message')?.textContent, 'The request is not valid.');
  assert.equal(stalePage.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  assert.equal(stalePage.querySelector('.primary-action')?.getAttribute('href'), '/signup');
  assert.equal(world.calls(), 0);
  assert.equal(world.inspections(), 0);
});

test('Given an unsupported signup request method, when it is refused, then the branded error keeps the Allow header and status', async () => {
  const world = setup();
  const response = await world.routes.handle(new Request('https://thermus.example/signup', { method: 'DELETE' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD, POST');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const page = parseHTML(await response.text()).document;
  assert.equal(page.querySelector('h1')?.textContent, 'Method not allowed');
  assert.equal(page.querySelector('.notice-message')?.textContent, 'This page does not accept this request method.');
  assert.equal(page.querySelector('header img')?.getAttribute('src'), '/assets/thermus-logo.svg');
  const policy = response.headers.get('Content-Security-Policy') ?? '';
  const styleHash = createHash('sha256').update(page.querySelector('style')?.textContent ?? '').digest('base64');
  assert.ok(policy.includes(`style-src 'sha256-${styleHash}'`));
  assert.equal((policy.match(/style-src /g) ?? []).length, 1);
  assert.equal(world.sessions(), 0);
  assert.equal(world.calls(), 0);
});

test('Given signup HEAD, when handled, then the response has no body and no session or activation work', async () => {
  const world = setup();
  const answer = await world.routes.handle(new Request('https://thermus.example/signup', { method: 'HEAD' }));
  assert.equal(await answer.text(), '');
  assert.equal(world.sessions(), 0);
  assert.equal(world.calls(), 0);
  assert.equal(world.inspections(), 0);
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
  assert.match(await answer.text(), /<a[^>]* href="mailto:legal@thermus.ai">Contact<\/a>/);
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

test('Given a cancelled signup inspection, when its provider read later completes, then no activation starts or failure detail is logged', async () => {
  const world = setup();
  let complete!: (state: { status: 'existing-access' }) => void;
  let started!: () => void;
  const inspecting = new Promise<void>((resolve) => { started = resolve; });
  world.activation.inspect = () => new Promise((resolve) => { complete = resolve; started(); });
  const cancellation = new AbortController();
  const answer = world.routes.handle(new Request('https://thermus.example/signup', { signal: cancellation.signal }));
  await inspecting;
  cancellation.abort(new Error('cancelled'));
  await assert.rejects(answer, /cancelled/);
  complete({ status: 'existing-access' });
  assert.equal(world.calls(), 0);
  assert.deepEqual(world.failures, []);
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
  const activation: SignupActivation = { inspect: async () => ({ status: 'eligible' }), activate: async () => { activations++; return { status: 'existing-access' }; } };
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


test('Given literal policy markup, when signup opens before or after sign-in, then the text stays intact and only same-origin assets and its hashed style are allowed', async () => {
  const literal = '</pre><script>policy & "text"</script>';
  const legalDocuments = { ...documents, terms: document(literal), notice: document(literal) };
  for (const signedIn of [false, true]) {
    const world = setup(true, signedIn);
    const routes = new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, documents: legalDocuments, session: world.session, activation: world.activation, reportFailure: () => {} });
    const response = await routes.handle(new Request('https://thermus.example/signup'));
    const page = parseHTML(await response.text()).document;
    assert.equal(page.querySelector('#privacy-notice .document-reader')?.textContent, literal);
    if (signedIn) assert.equal(page.querySelector('#terms .document-reader')?.textContent, literal);
    assert.equal(page.querySelectorAll('script').length, 0);
    const css = page.querySelector('style')?.textContent;
    assert.ok(css);
    assert.match(css, /white-space:\s*pre-wrap/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    const hash = createHash('sha256').update(css).digest('base64');
    const policy = response.headers.get('Content-Security-Policy') ?? '';
    assert.ok(policy.includes(`style-src 'sha256-${hash}'`), policy);
    assert.match(policy, /default-src 'none'/);
    assert.ok(policy.includes(`form-action '${signedIn ? 'self' : 'none'}'`), policy);
    assert.match(policy, /img-src 'self'/);
    assert.match(policy, /font-src 'self'/);
    assert.doesNotMatch(policy, /unsafe-inline|script-src/);
  }
});
