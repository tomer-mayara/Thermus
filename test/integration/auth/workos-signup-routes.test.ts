import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import type { BrowserSessionState, SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';
import type { BrowserSignInRequest, BrowserSignInStart } from '../../../src/accounts/identity/browser-session-controls.ts';
import { WorkOSSignupRoutes, type WorkOSSignupRoutesOptions } from '../../../src/interfaces/web/auth/workos/workos-signup-routes.ts';
import type { AccountLookup, SignupActivation, SignupDocuments } from '../../../src/accounts/organizations/signup-activation.ts';

const document = (text: string) => ({ version: 'v1', text, sha256: createHash('sha256').update(text).digest('hex') });
const documents: SignupDocuments = { purpose: 'organization-creation', version: 'v1', terms: document('Test <terms>'), notice: document('Test <notice>'), agreement: { version: 'v1', text: 'TEST ONLY. I accept the test terms and have authority to act for this organization.' } };

const authKitStart: BrowserSignInStart = { url: 'https://authkit.example/sign-up?state=state-1', cookies: ['sign-in=started; Secure'] };

function setup(enabled = true, signedIn = true, publicBaseUrl = 'https://thermus.example/') {
  let calls = 0;
  let inspections = 0;
  let sessions = 0;
  const failures: string[] = [];
  const names: string[] = [];
  const selections: string[] = [];
  const starts: BrowserSignInRequest[] = [];
  const lookups: string[] = [];
  const state: BrowserSessionState = signedIn ? { status: 'signed-in', user: { authority: 'workos:test', subject: 'user_test' }, csrfToken: 'secret', mfaCompleted: false,
    cookies: ['renewed=session; Secure'], selectOrganization: async (id) => { selections.push(id); return { status: 'switched', cookies: ['renewed=selected; Secure'] }; } } : { status: 'signed-out', cookies: [] };
  const session: WorkOSSignupRoutesOptions['session'] = { authenticate: async () => { sessions++; return state; }, startSignIn: async (request) => { starts.push(request); return authKitStart; } };
  const activation: SignupActivation = { inspect: async () => { inspections++; return { status: 'eligible' }; }, activate: async (request) => { calls++; names.push(request.organizationName); return { status: 'active', organizationId: 'org_new' }; },
    findAccount: async (request) => { lookups.push(request.email); return { status: 'absent' }; } };
  const routes = new WorkOSSignupRoutes({ publicBaseUrl, enabled, documents, session, activation, reportFailure: (message) => failures.push(message) });
  return { routes, activation, session, state, failures, names, selections, starts, lookups, calls: () => calls, sessions: () => sessions, inspections: () => inspections };
}

const start = (method = 'GET', url = 'https://thermus.example/signup/start') => new Request(url, { method });

interface StepOnePost {
  readonly origin?: string | null;
  readonly url?: string;
  readonly contentType?: string;
  readonly signal?: AbortSignal;
}

// The POST of the email form of step 1.
function postEmail(body = 'email=new%40example.com', options: StepOnePost = {}): Request {
  const headers = new Headers({ 'Content-Type': options.contentType ?? 'application/x-www-form-urlencoded' });
  if (options.origin !== null) headers.set('Origin', options.origin ?? 'https://thermus.example');
  return new Request(options.url ?? 'https://thermus.example/signup/start', { method: 'POST', headers, body, signal: options.signal });
}

const acceptedForm = 'csrf_token=secret&document_version=v1&organization_name=Acme+Labs&agreement=accepted';

function post(body = acceptedForm, origin = 'https://thermus.example'): Request {
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

test('Given open signup, when Create account is opened, then the provider sign-in starts at its sign-up screen with the return to signup, without a session read', async () => {
  const world = setup();

  const answer = await world.routes.handle(start());

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), authKitStart.url);
  assert.deepEqual(answer.headers.getSetCookie(), authKitStart.cookies);
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(world.starts, [{ returnTo: '/signup', screenHint: 'sign-up' }]);
  assert.equal(world.sessions(), 0);
  assert.equal(world.inspections(), 0);
  assert.equal(world.routes.handles('/signup/start'), true);
});

test('Given open signup, when Create account gets HEAD, then the answer has the status and headers of GET and no body', async () => {
  const world = setup();

  const answer = await world.routes.handle(start('HEAD'));

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), authKitStart.url);
  assert.deepEqual(answer.headers.getSetCookie(), authKitStart.cookies);
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  assert.equal(await answer.text(), '');
});

test('Given Create account, when another method arrives, then the branded refusal allows GET, HEAD, and POST and no provider sign-in starts', async () => {
  const world = setup();

  const answer = await world.routes.handle(start('DELETE'));

  assert.equal(answer.status, 405);
  assert.equal(answer.headers.get('Allow'), 'GET, HEAD, POST');
  assert.equal(parseHTML(await answer.text()).document.querySelector('h1')?.textContent, 'Method not allowed');
  assert.deepEqual(world.starts, []);
  assert.deepEqual(world.lookups, []);
});

test('Given open signup and an email without an account, when step 1 posts it, then the provider sign-in starts at its sign-up screen with the normalized email as login hint and the return to signup, without a session read', async () => {
  const world = setup();

  const answer = await world.routes.handle(postEmail('email=+New%40Example.COM+'));

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), authKitStart.url);
  assert.deepEqual(answer.headers.getSetCookie(), authKitStart.cookies);
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(world.lookups, ['new@example.com']);
  assert.deepEqual(world.starts, [{ returnTo: '/signup', screenHint: 'sign-up', loginHint: 'new@example.com' }]);
  assert.equal(world.sessions(), 0);
  assert.deepEqual(world.failures, []);
});

test('Given an email that has an account, when step 1 posts it, then step 1 answers 409 with the message, a Sign in link, and the email in the field, and no provider sign-in starts', async () => {
  const world = setup();
  world.activation.findAccount = async (request) => { world.lookups.push(request.email); return { status: 'found' }; };

  const answer = await world.routes.handle(postEmail('email=Person%40Example.com'));

  assert.equal(answer.status, 409);
  assert.equal(answer.headers.get('Location'), null);
  assert.deepEqual(answer.headers.getSetCookie(), []);
  assert.match(answer.headers.get('Content-Security-Policy') ?? '', /form-action 'self'/);
  const page = parseHTML(await answer.text()).document;
  assert.equal(page.querySelector('.form-message')?.textContent, 'An account with this email address already exists. Sign in to open your workspace.');
  assert.equal(page.querySelector('.form-message a')?.getAttribute('href'), '/login');
  assert.equal(page.querySelector('form')?.getAttribute('action'), '/signup/start');
  assert.equal(page.querySelector('input[name="email"]')?.getAttribute('value'), 'person@example.com');
  assert.deepEqual(world.lookups, ['person@example.com']);
  assert.deepEqual(world.starts, []);
  assert.deepEqual(world.failures, []);
});

test('Given an account lookup that is unavailable, when step 1 posts an email, then the provider sign-in still starts with the login hint and the log has one fixed line', async () => {
  const world = setup();
  world.activation.findAccount = async () => ({ status: 'unavailable' });

  const answer = await world.routes.handle(postEmail());

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), authKitStart.url);
  assert.deepEqual(world.starts, [{ returnTo: '/signup', screenHint: 'sign-up', loginHint: 'new@example.com' }]);
  assert.deepEqual(world.failures, ['Hosted signup could not check the email address.']);
});

test('Given a missing, repeated, or invalid email, when step 1 posts it, then step 1 answers 400 with the message and keeps the typed text, and no lookup or provider sign-in starts', async () => {
  const cases = [
    { body: '', typed: '' },
    { body: 'email=', typed: '' },
    { body: 'email=+++', typed: '' },
    { body: 'email=person', typed: 'person' },
    { body: 'email=person%40example', typed: 'person@example' },
    { body: 'email=%40example.com', typed: '@example.com' },
    { body: 'email=person%40.com', typed: 'person@.com' },
    { body: 'email=a%40b.c%40d.e', typed: 'a@b.c@d.e' },
    { body: 'email=two+words%40example.com', typed: 'two words@example.com' },
    { body: 'email=person%40exa%00mple.com', typed: 'person@exa\u0000mple.com' },
    { body: 'email=a%40b.com&email=a%40b.com', typed: '' },
    { body: `email=${'a'.repeat(243)}%40example.com`, typed: '' },
  ];
  for (const { body, typed } of cases) {
    const world = setup();
    const answer = await world.routes.handle(postEmail(body));
    assert.equal(answer.status, 400, body);
    const page = parseHTML(await answer.text()).document;
    assert.equal(page.querySelector('.form-message')?.textContent, 'Enter a valid email address.', body);
    assert.equal(page.querySelector('input[name="email"]')?.getAttribute('value') ?? '', typed, body);
    assert.deepEqual(world.lookups, [], body);
    assert.deepEqual(world.starts, [], body);
    assert.deepEqual(world.failures, [], body);
  }
});

test('Given an email of 254 characters, when step 1 posts it, then the lookup gets it', async () => {
  const world = setup();
  const email = `${'a'.repeat(242)}@example.com`;

  const answer = await world.routes.handle(postEmail(new URLSearchParams({ email }).toString()));

  assert.equal(email.length, 254);
  assert.equal(answer.status, 303);
  assert.deepEqual(world.lookups, [email]);
});

test('Given a foreign or missing Origin, when step 1 posts an email, then the branded refusal answers and no lookup or provider sign-in starts', async () => {
  for (const origin of ['https://other.example', null]) {
    const world = setup();
    const answer = await world.routes.handle(postEmail(undefined, { origin }));
    assert.equal(answer.status, 403);
    const page = parseHTML(await answer.text()).document;
    assert.equal(page.querySelector('h1')?.textContent, 'Request refused');
    assert.equal(page.querySelector('.primary-action')?.getAttribute('href'), '/signup');
    assert.deepEqual(world.lookups, []);
    assert.deepEqual(world.starts, []);
  }
});

test('Given closed signup, when step 1 posts an email, then the closed notice answers 403 and no lookup or provider sign-in starts', async () => {
  const world = setup(false);

  const answer = await world.routes.handle(postEmail());

  assert.equal(answer.status, 403);
  assert.match(await answer.text(), /Activation is closed/);
  assert.deepEqual(world.lookups, []);
  assert.deepEqual(world.starts, []);
});

test('Given a body that is not HTML form data or is too large, when step 1 posts it, then the branded refusal keeps its status and no lookup starts', async () => {
  const world = setup();

  const typed = await world.routes.handle(postEmail('{"email":"new@example.com"}', { contentType: 'application/json' }));
  const large = await world.routes.handle(postEmail(`email=${'a'.repeat(16 * 1024)}`));

  assert.equal(typed.status, 415);
  assert.equal(parseHTML(await typed.text()).document.querySelector('h1')?.textContent, 'Form not accepted');
  assert.equal(large.status, 413);
  assert.deepEqual(world.lookups, []);
  assert.deepEqual(world.starts, []);
});

test('Given a provider start that fails after the lookup, when step 1 posts an email, then the failure page answers and the log has only fixed text', async () => {
  const world = setup();
  world.session.startSignIn = async () => { throw new Error('secret provider detail'); };

  const answer = await world.routes.handle(postEmail());

  assert.equal(answer.status, 503);
  const html = await answer.text();
  assert.match(html, /Activation is temporarily unavailable/);
  assert.doesNotMatch(html, /secret/);
  assert.deepEqual(world.lookups, ['new@example.com']);
  assert.deepEqual(world.failures, ['Hosted signup request failed.']);
});

test('Given a cancelled step 1 request, when its lookup completes later, then no provider sign-in starts and no failure is logged', async () => {
  const world = setup();
  let complete!: (lookup: AccountLookup) => void;
  let started!: () => void;
  const looking = new Promise<void>((resolve) => { started = resolve; });
  world.activation.findAccount = () => new Promise((resolve) => { complete = resolve; started(); });
  const cancellation = new AbortController();

  const answer = world.routes.handle(postEmail(undefined, { signal: cancellation.signal }));
  await looking;
  cancellation.abort(new Error('cancelled'));

  await assert.rejects(answer, /cancelled/);
  complete({ status: 'absent' });
  assert.deepEqual(world.starts, []);
  assert.deepEqual(world.failures, []);
});

test('Given three posts of one email in a minute, when a fourth post of that email arrives, then admission refuses it before the lookup, and another email still starts', async () => {
  const world = setup();
  for (const body of ['email=person%40example.com', 'email=Person%40Example.com', 'email=+person%40example.com']) {
    assert.equal((await world.routes.handle(postEmail(body))).status, 303, body);
  }
  assert.equal((await world.routes.handle(postEmail('email=person'))).status, 400);

  const refused = await world.routes.handle(postEmail('email=PERSON%40example.com'));

  assert.equal(refused.status, 429);
  assert.equal(refused.headers.get('Retry-After'), '60');
  assert.deepEqual(world.lookups, ['person@example.com', 'person@example.com', 'person@example.com']);
  assert.equal((await world.routes.handle(postEmail('email=other%40example.com'))).status, 303);
});

test('Given eight step 1 posts with lookups still running, when another POST of step 1 or of the organization form arrives, then admission refuses it before the form, the lookup, and the session', async () => {
  const world = setup();
  const pending: Array<(lookup: AccountLookup) => void> = [];
  let allStarted!: () => void;
  const started = new Promise<void>((resolve) => { allStarted = resolve; });
  world.activation.findAccount = () => new Promise((resolve) => { pending.push(resolve); if (pending.length === 8) allStarted(); });
  const requests = Array.from({ length: 8 }, (_, index) => world.routes.handle(postEmail(`email=person${index}%40example.com`)));

  assert.equal((await world.routes.handle(postEmail('email=other%40example.com'))).status, 429);
  assert.equal((await world.routes.handle(post())).status, 429);
  assert.equal(world.sessions(), 0);
  await started;
  for (const resolve of pending) resolve({ status: 'absent' });
  assert.deepEqual((await Promise.all(requests)).map(({ status }) => status), Array(8).fill(303));
  world.activation.findAccount = async () => ({ status: 'absent' });
  assert.equal((await world.routes.handle(postEmail('email=other%40example.com'))).status, 303);
});

test('Given closed signup, when Create account gets GET or HEAD, then the closed notice answers and no provider sign-in starts', async () => {
  const world = setup(false);

  const page = await world.routes.handle(start());
  const head = await world.routes.handle(start('HEAD'));

  assert.equal(page.status, 200);
  assert.match(await page.text(), /Activation is closed/);
  assert.equal(page.headers.get('Location'), null);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.deepEqual(world.starts, []);
  assert.equal(world.sessions(), 0);
});

test('Given a provider start that fails, when Create account is opened, then the failure page answers and the log has only fixed text', async () => {
  const world = setup();
  world.session.startSignIn = async () => { throw new Error('secret provider detail'); };

  const answer = await world.routes.handle(start());

  assert.equal(answer.status, 503);
  const html = await answer.text();
  assert.match(html, /Activation is temporarily unavailable/);
  assert.doesNotMatch(html, /secret/);
  assert.deepEqual(world.failures, ['Hosted signup request failed.']);
});

test('Given a cancelled Create account request, when the provider start completes later, then no failure is logged', async () => {
  const world = setup();
  let complete!: (value: BrowserSignInStart) => void;
  let started!: () => void;
  const starting = new Promise<void>((resolve) => { started = resolve; });
  world.session.startSignIn = () => new Promise((resolve) => { complete = resolve; started(); });
  const cancellation = new AbortController();

  const answer = world.routes.handle(new Request('https://thermus.example/signup/start', { signal: cancellation.signal }));
  await Promise.race([starting, answer]);
  cancellation.abort(new Error('cancelled'));

  await assert.rejects(answer, /cancelled/);
  complete(authKitStart);
  assert.deepEqual(world.failures, []);
});

test('Given enabled signup without approved documents, when composed, then startup fails', () => {
  const world = setup();
  assert.throws(() => new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, session: world.session, activation: world.activation, reportFailure: () => {} }));
});

test('Given legacy personal-access documents, when organization creation is enabled, then composition refuses the old agreement', () => {
  const world = setup();
  const { purpose: _purpose, ...legacyDocuments } = documents;
  assert.throws(() => new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, documents: legacyDocuments,
    session: world.session, activation: world.activation, reportFailure: () => {} }), /organization.*documents/i);
});

test('Given signed-out signup, when opened, then the full escaped notice appears before the email form of Create account, and the sign-in line opens login without a return path', async () => {
  const world = setup(true, false);
  const answer = await world.routes.handle(new Request('https://thermus.example/signup'));
  const html = await answer.text();
  const page = parseHTML(html).document;
  assert.match(html, /Test &lt;notice&gt;/);
  assert.equal(page.querySelector('.task-card form')?.getAttribute('action'), '/signup/start');
  assert.equal(page.querySelector('.task-card form input[name="email"]')?.getAttribute('type'), 'email');
  assert.equal(page.querySelector('a[href="/login"]')?.textContent, 'Sign in');
  assert.doesNotMatch(html, /return_to/);
  assert.ok(html.indexOf('Test &lt;notice&gt;') < html.indexOf('>Create account</button>'));
  assert.equal(world.inspections(), 0);
  assert.deepEqual(world.starts, []);
});

test('Given an existing account without product access, when signup is read, then it says the account exists and offers the selector without agreement or activation', async () => {
  const world = setup();
  world.activation.inspect = async () => ({ status: 'existing-account' });

  const answer = await world.routes.handle(new Request('https://thermus.example/signup'));

  assert.equal(answer.status, 200);
  const page = parseHTML(await answer.text()).document;
  assert.equal(page.querySelector('h1')?.textContent, 'You already have a Thermus account');
  assert.equal(page.querySelector('.primary-action')?.getAttribute('href'), '/organizations?return_to=%2F');
  assert.equal(page.querySelector('.primary-action')?.textContent, 'Open your workspace');
  assert.equal(page.querySelector('.secondary-action')?.getAttribute('href'), 'mailto:legal@thermus.ai');
  assert.equal(page.querySelectorAll('form, input').length, 0);
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure']);
  assert.equal(world.calls(), 0);
});

test('Given an existing account returned during creation, when the form is posted, then it refuses with the existing-account page and no organization switch', async () => {
  const world = setup();
  world.activation.activate = async () => ({ status: 'existing-account' });

  const answer = await world.routes.handle(post());

  assert.equal(answer.status, 403);
  const page = parseHTML(await answer.text()).document;
  assert.equal(page.querySelector('h1')?.textContent, 'You already have a Thermus account');
  assert.equal(page.querySelector('.primary-action')?.getAttribute('href'), '/organizations?return_to=%2F');
  assert.equal(answer.headers.get('Location'), null);
  assert.deepEqual(world.selections, []);
});

test('Given signed-in signup and the current agreement, when a valid name is posted, then it switches to the confirmed organization and opens Quick start with the latest cookie', async () => {
  const world = setup();
  const form = await (await world.routes.handle(new Request('https://thermus.example/signup'))).text();
  assert.match(form, /type="checkbox" name="agreement" value="accepted" required/);
  assert.equal(parseHTML(form).document.querySelector('input[name="agreement"]')?.hasAttribute('checked'), false);
  assert.doesNotMatch(form, /return_to/);
  assert.match(form, /Test &lt;terms&gt;/);
  const answer = await world.routes.handle(post(acceptedForm.replace('Acme+Labs', '+Acme+Labs+')));
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/quick-start');
  assert.equal(answer.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(answer.headers.getSetCookie(), ['renewed=session; Secure', 'renewed=selected; Secure']);
  assert.deepEqual(world.names, ['Acme Labs']);
  assert.deepEqual(world.selections, ['org_new']);
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

test('Given a public-base path, when a visitor opens signup, follows Create account, or posts an email, then the form, the links, and the return to signup use that path', async () => {
  const world = setup(true, false, 'https://thermus.example/app/');
  const creation = 'https://thermus.example/app/signup/start';

  const page = parseHTML(await (await world.routes.handle(new Request('https://thermus.example/app/signup'))).text()).document;
  const answer = await world.routes.handle(start('GET', creation));
  const posted = await world.routes.handle(postEmail(undefined, { url: creation }));
  world.activation.findAccount = async () => ({ status: 'found' });
  const found = parseHTML(await (await world.routes.handle(postEmail('email=person%40example.com', { url: creation }))).text()).document;

  assert.equal(page.querySelector('.task-card form')?.getAttribute('action'), '/app/signup/start');
  assert.equal(page.querySelector('a[href="/app/login"]')?.textContent, 'Sign in');
  assert.equal(answer.status, 303);
  assert.equal(posted.status, 303);
  assert.deepEqual(world.starts, [{ returnTo: '/app/signup', screenHint: 'sign-up' }, { returnTo: '/app/signup', screenHint: 'sign-up', loginHint: 'new@example.com' }]);
  assert.equal(found.querySelector('form')?.getAttribute('action'), '/app/signup/start');
  assert.equal(found.querySelector('.form-message a')?.getAttribute('href'), '/app/login');
  assert.equal(world.routes.handles('/app/signup/start'), true);
  assert.equal(world.routes.handles('/signup/start'), false);
});

test('Given a public-base path, when existing access continues or creation succeeds, then the selector and direct landing use that server-owned portal path', async () => {
  const world = setup(true, true, 'https://thermus.example/app/');
  world.activation.inspect = async () => ({ status: 'existing-access' });
  const page = await world.routes.handle(new Request('https://thermus.example/app/signup?return_to=/other'));
  assert.match(await page.text(), /href="\/app\/organizations\?return_to=%2Fapp%2F"/);
  const activation = new Request('https://thermus.example/app/signup', post());
  const answer = await world.routes.handle(activation);
  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/app/quick-start');
});

test('Given unchecked, stale, forged, repeated, missing, or invalid creation fields, when posted, then the route refuses them without activation or switching', async () => {
  const cases = [
    { body: acceptedForm.replace('&agreement=accepted', ''), status: 400 },
    { body: acceptedForm.replace('document_version=v1', 'document_version=old'), status: 400 },
    { body: acceptedForm.replace('&document_version=v1', ''), status: 400 },
    { body: acceptedForm.replace('csrf_token=secret', 'csrf_token=wrong'), status: 403 },
    { body: acceptedForm.replace('csrf_token=secret&', ''), status: 403 },
    { body: acceptedForm.replace('&organization_name=Acme+Labs', ''), status: 400 },
    { body: acceptedForm.replace('Acme+Labs', ''), status: 400 },
    { body: acceptedForm.replace('Acme+Labs', '+%09+'), status: 400 },
    { body: acceptedForm.replace('Acme+Labs', 'Acme%00Labs'), status: 400 },
    { body: acceptedForm.replace('Acme+Labs', 'A'.repeat(101)), status: 400 },
    { body: `${acceptedForm}&organization_name=Other`, status: 400 },
    { body: `${acceptedForm}&agreement=accepted`, status: 400 },
    { body: `${acceptedForm}&document_version=v1`, status: 400 },
    { body: `${acceptedForm}&csrf_token=secret`, status: 403 },
    { body: `${acceptedForm}&subject=user`, status: 400 },
    { body: acceptedForm.replace('agreement=accepted', 'agreement=false'), status: 400 },
  ];
  for (const { body, status } of cases) {
    const world = setup();
    const answer = await world.routes.handle(post(body));
    assert.equal(answer.status, status, body);
    assert.equal(world.calls(), 0, body);
    assert.deepEqual(world.selections, [], body);
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

test('Given the origins of the provider sign-in, when step 1 is shown before or after a POST, then its policy allows the form and the redirects to those origins once each', async () => {
  const world = setup(true, false);
  const routes = new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled: true, documents, session: world.session, activation: world.activation,
    reportFailure: () => {}, providerOrigins: ['https://api.workos.com/', 'https://auth.example.com', 'https://auth.example.com/authkit'] });
  world.activation.findAccount = async () => ({ status: 'found' });

  const pages = [await routes.handle(new Request('https://thermus.example/signup')), await routes.handle(postEmail('email=person%40example.com')), await routes.handle(postEmail('email=person'))];

  assert.deepEqual(pages.map(({ status }) => status), [200, 409, 400]);
  for (const page of pages) assert.ok((page.headers.get('Content-Security-Policy') ?? '').includes("form-action 'self' https://api.workos.com https://auth.example.com;"));
});

test('Given open signup, when HEAD arrives, then it gets the status and the page headers of step 1, which allow its form', async () => {
  const world = setup(true, false);

  const head = await world.routes.handle(new Request('https://thermus.example/signup', { method: 'HEAD' }));
  const page = await world.routes.handle(new Request('https://thermus.example/signup'));

  assert.equal(head.status, page.status);
  for (const name of ['Content-Type', 'Cache-Control', 'Content-Security-Policy', 'X-Frame-Options']) assert.equal(head.headers.get(name), page.headers.get(name), name);
  assert.match(head.headers.get('Content-Security-Policy') ?? '', /form-action 'self'/);
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

for (const outcome of ['refused', 'signed-out', 'outage'] as const) {
  test(`Given confirmed creation and a ${outcome} session switch, when the form is posted, then it offers recovery without repeating activation`, async () => {
    const world = setup();
    const state = world.state as SignedInBrowserSession;
    state.selectOrganization = async (id) => {
      world.selections.push(id);
      if (outcome === 'outage') throw new Error('secret switch failure');
      return { status: outcome, cookies: ['renewed=refused; Secure'] };
    };
    const response = await world.routes.handle(post());
    assert.equal(response.status, outcome === 'signed-out' ? 401 : outcome === 'refused' ? 403 : 503);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(response.headers.getSetCookie(), outcome === 'outage'
      ? ['renewed=session; Secure'] : ['renewed=session; Secure', 'renewed=refused; Secure']);
    const page = parseHTML(await response.text()).document;
    assert.ok(page.querySelector('a.primary-action'));
    assert.doesNotMatch(page.body.textContent, /secret switch failure/);
    assert.equal(world.calls(), 1);
    assert.deepEqual(world.selections, ['org_new']);
  });
}

test('Given existing access returned during creation, when the form is posted, then the selector handles that access without switching to a new organization', async () => {
  const world = setup();
  world.activation.activate = async () => ({ status: 'existing-access' });
  const response = await world.routes.handle(post());
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), 'https://thermus.example/organizations?return_to=%2F');
  assert.deepEqual(world.selections, []);
});

test('Given a cancelled organization switch, when it later completes, then no new activation starts and no failure detail is logged', async () => {
  const world = setup();
  const state = world.state as SignedInBrowserSession;
  let complete!: (value: { status: 'switched'; cookies: string[] }) => void;
  let started!: () => void;
  const switching = new Promise<void>((resolve) => { started = resolve; });
  state.selectOrganization = () => new Promise((resolve) => { complete = resolve; started(); });
  const cancellation = new AbortController();
  const response = world.routes.handle(new Request(post(), { signal: cancellation.signal }));
  await switching;
  cancellation.abort(new Error('cancelled'));
  await assert.rejects(response, /cancelled/);
  complete({ status: 'switched', cookies: [] });
  assert.equal(world.calls(), 1);
  assert.deepEqual(world.failures, []);
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
  const session: WorkOSSignupRoutesOptions['session'] = { authenticate: async () => ({ status: 'signed-in', user: { authority: 'workos:test', subject }, csrfToken: 'secret', mfaCompleted: false,
    cookies: [], selectOrganization: async () => { throw new Error('No switch'); } }), startSignIn: async () => authKitStart };
  const activation: SignupActivation = { inspect: async () => ({ status: 'eligible' }), activate: async () => { activations++; return { status: 'existing-access' }; }, findAccount: async () => ({ status: 'absent' }) };
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
    assert.ok(policy.includes("form-action 'self'"), policy);
    assert.match(policy, /img-src 'self'/);
    assert.match(policy, /font-src 'self'/);
    assert.doesNotMatch(policy, /unsafe-inline|script-src/);
  }
});
