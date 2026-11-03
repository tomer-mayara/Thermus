import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { BrowserSessionState, SignedInBrowserSession } from '../../../src/accounts/identity/browser-session.ts';
import { WorkOSSignupRoutes, type WorkOSSignupRoutesOptions } from '../../../src/interfaces/web/auth/workos/workos-signup-routes.ts';
import type { SignupPlace, SignupTenantRequest, SignupTenants } from '../../../src/interfaces/web/auth/workos/workos-signup-tenants.ts';
import type { SignupActivation, SignupDocuments } from '../../../src/accounts/organizations/signup-activation.ts';

// SO-07: the handoff of signup to the tenant of a new organization. The free-tenant cap comes after the switch and
// before the notice, and the tenant request after the confirmed first Admin membership. The routes run with doubles of
// the session and the activation and a spy of the tenant port that app composes.

const document = (text: string) => ({ version: 'v1', text, sha256: createHash('sha256').update(text).digest('hex') });
const documents: SignupDocuments = { purpose: 'organization-creation', version: 'v1', terms: document('Test <terms>'), notice: document('Test <notice>'), agreement: { version: 'v1', text: 'TEST ONLY. I accept the test terms and have authority to act for this organization.' } };
const acceptedForm = 'csrf_token=secret&document_version=v1&organization_name=Acme+Labs&agreement=accepted';

function post(body = acceptedForm, origin = 'https://thermus.example'): Request {
  return new Request('https://thermus.example/signup', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

const createAccount = () => new Request('https://thermus.example/signup/start');
// The POST of the email form of step 1.
const postEmail = () => new Request('https://thermus.example/signup/start', { method: 'POST', headers: { Origin: 'https://thermus.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=new%40example.com' });

// A spy of the tenant registry port of signup: the place under the free-tenant cap that a case gives, and each check
// and tenant request, with the organization name, in order.
class SignupTenantsSpy implements SignupTenants {
  readonly events: string[] = [];
  placeAnswer: SignupPlace | Error = 'open';
  requestAnswer: SignupTenantRequest | Error = 'requested';

  async place(): Promise<SignupPlace> {
    this.events.push('place');
    if (this.placeAnswer instanceof Error) throw this.placeAnswer;
    return this.placeAnswer;
  }

  async request(organizationId: string, organizationName: string): Promise<SignupTenantRequest> {
    this.events.push(`request ${organizationId} ${organizationName}`);
    if (this.requestAnswer instanceof Error) throw this.requestAnswer;
    return this.requestAnswer;
  }
}

// The routes with open or closed signup, a signed-in or a signed-out session, and the spy of the tenant port.
function setup(options: { readonly enabled?: boolean; readonly signedIn?: boolean } = {}) {
  const { enabled = true, signedIn = true } = options;
  const tenants = new SignupTenantsSpy();
  let sessions = 0;
  let calls = 0;
  const failures: string[] = [];
  const selections: string[] = [];
  const state: BrowserSessionState = signedIn ? { status: 'signed-in', user: { authority: 'workos:test', subject: 'user_test' }, csrfToken: 'secret', mfaCompleted: false, cookies: [],
    selectOrganization: async (id) => { tenants.events.push(`select ${id}`); selections.push(id); return { status: 'switched', cookies: [] }; } } : { status: 'signed-out', cookies: [] };
  const session: WorkOSSignupRoutesOptions['session'] = { authenticate: async () => { sessions++; return state; },
    startSignIn: async (request) => { tenants.events.push(`start ${request.screenHint}`); return { url: 'https://authkit.example/sign-up', cookies: ['sign-in=started; Secure'] }; } };
  const activation: SignupActivation = { inspect: async () => ({ status: 'eligible' }), activate: async (request) => { calls++; tenants.events.push(`activate ${request.organizationName}`); return { status: 'active', organizationId: 'org_new' }; },
    findAccount: async (request) => { tenants.events.push(`find ${request.email}`); return { status: 'absent' }; } };
  const routes = new WorkOSSignupRoutes({ publicBaseUrl: 'https://thermus.example/', enabled, documents, session, activation, tenants, reportFailure: (message) => failures.push(message) });
  const starts = () => tenants.events.filter((event) => event.startsWith('start ')).length;
  return { routes, activation, tenants, state: state as SignedInBrowserSession, failures, selections, sessions: () => sessions, calls: () => calls, starts };
}

test('Given ?tier=free, another tier value, or no tier, when a signed-out or a signed-in visitor opens signup, then the route treats each as ?tier=free', async () => {
  for (const signedIn of [false, true]) {
    const world = setup({ signedIn });
    const free = await (await world.routes.handle(new Request('https://thermus.example/signup?tier=free'))).text();
    for (const query of ['?tier=team', '?tier=', '?tier=free&tier=team', '?tier=%00', '']) {
      const answer = await world.routes.handle(new Request(`https://thermus.example/signup${query}`));
      assert.equal(answer.status, 200, query);
      assert.equal(await answer.text(), free, query);
    }
    assert.equal(free.includes(signedIn ? 'Create organization' : 'Create account'), true);
  }
});

test('Given closed signup, when GET, HEAD, POST, or Create account arrives, then the switch answers before the cap and no tenant work starts', async () => {
  const world = setup({ enabled: false });
  for (const request of [new Request('https://thermus.example/signup?tier=free'), new Request('https://thermus.example/signup', { method: 'HEAD' }), post(), createAccount(), postEmail()]) {
    const answer = await world.routes.handle(request);
    assert.equal(answer.headers.get('Content-Type'), 'text/html; charset=utf-8');
  }
  assert.deepEqual(world.tenants.events, []);
  assert.equal(world.sessions(), 0);
  assert.equal(world.starts(), 0);
});

test('Given a full free-tenant cap, when GET, HEAD, POST, or Create account arrives, then signup shows the closed notice before the notice of the documents, with no session, provider sign-in, activation, or tenant work', async () => {
  const world = setup();
  world.tenants.placeAnswer = 'full';
  const page = await world.routes.handle(new Request('https://thermus.example/signup?tier=free'));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Activation is closed/);
  assert.doesNotMatch(html, /Test &lt;notice&gt;|checkbox/);
  const head = await world.routes.handle(new Request('https://thermus.example/signup', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const posted = await world.routes.handle(post());
  assert.equal(posted.status, 403);
  assert.match(await posted.text(), /Activation is closed/);
  const creation = await world.routes.handle(createAccount());
  assert.equal(creation.status, 200);
  assert.equal(creation.headers.get('Location'), null);
  assert.match(await creation.text(), /Activation is closed/);
  assert.deepEqual(world.tenants.events, ['place', 'place', 'place', 'place']);
  assert.equal(world.sessions(), 0);
  assert.equal(world.starts(), 0);
  assert.equal(world.calls(), 0);
});

test('Given a full free-tenant cap, when step 1 posts an email, then the closed notice answers 403 after the cap read, with no account lookup or provider sign-in', async () => {
  const world = setup();
  world.tenants.placeAnswer = 'full';

  const answer = await world.routes.handle(postEmail());

  assert.equal(answer.status, 403);
  assert.equal(answer.headers.get('Location'), null);
  assert.match(await answer.text(), /Activation is closed/);
  assert.deepEqual(world.tenants.events, ['place']);
  assert.equal(world.sessions(), 0);
});

for (const failure of ['unavailable', 'exception'] as const) {
  test(`Given a cap read that is ${failure}, when step 1 posts an email, then it reports unavailability with no account lookup or provider sign-in`, async () => {
    const world = setup();
    world.tenants.placeAnswer = failure === 'exception' ? new Error('private registry detail') : 'unavailable';

    const answer = await world.routes.handle(postEmail());

    assert.equal(answer.status, 503);
    const html = await answer.text();
    assert.match(html, /Activation is temporarily unavailable/);
    assert.doesNotMatch(html, /private registry detail/);
    assert.deepEqual(world.failures, ['Hosted signup could not read the free-tenant cap.']);
    assert.deepEqual(world.tenants.events, ['place']);
  });
}

test('Given a place under the cap, when step 1 posts an email without an account, then the account lookup and the provider sign-in start after the cap read', async () => {
  const world = setup();

  const answer = await world.routes.handle(postEmail());

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://authkit.example/sign-up');
  assert.deepEqual(world.tenants.events, ['place', 'find new@example.com', 'start sign-up']);
});

test('Given a cap read that is unavailable, when Create account is opened, then it reports unavailability and no provider sign-in starts', async () => {
  const world = setup();
  world.tenants.placeAnswer = 'unavailable';

  const answer = await world.routes.handle(createAccount());

  assert.equal(answer.status, 503);
  assert.match(await answer.text(), /Activation is temporarily unavailable/);
  assert.deepEqual(world.failures, ['Hosted signup could not read the free-tenant cap.']);
  assert.equal(world.starts(), 0);
});

test('Given a place under the cap, when Create account is opened, then the provider sign-in starts after the cap read', async () => {
  const world = setup();

  const answer = await world.routes.handle(createAccount());

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://authkit.example/sign-up');
  assert.deepEqual(world.tenants.events, ['place', 'start sign-up']);
});

for (const failure of ['unavailable', 'exception'] as const) {
  test(`Given a cap read that is ${failure}, when signup opens or is posted, then it reports unavailability with no session or activation work`, async () => {
    const world = setup();
    world.tenants.placeAnswer = failure === 'exception' ? new Error('private registry detail') : 'unavailable';
    for (const request of [new Request('https://thermus.example/signup?tier=free'), post()]) {
      const answer = await world.routes.handle(request);
      assert.equal(answer.status, 503);
      const html = await answer.text();
      assert.match(html, /Activation is temporarily unavailable/);
      assert.doesNotMatch(html, /private registry detail|checkbox/);
    }
    assert.deepEqual(world.failures, ['Hosted signup could not read the free-tenant cap.', 'Hosted signup could not read the free-tenant cap.']);
    assert.equal(world.sessions(), 0);
    assert.equal(world.calls(), 0);
  });
}

test('Given a place under the cap and confirmed creation, when the form is posted, then the tenant of the new organization is requested once with the organization name of the form, after the confirmed first Admin membership and before Quick start opens', async () => {
  const world = setup();

  const answer = await world.routes.handle(post());

  assert.equal(answer.status, 303);
  assert.equal(answer.headers.get('Location'), 'https://thermus.example/quick-start');
  assert.deepEqual(world.tenants.events, ['place', 'activate Acme Labs', 'request org_new Acme Labs', 'select org_new']);
  assert.deepEqual(world.failures, []);
});

for (const result of [{ status: 'support-required' }, { status: 'unverified' }, { status: 'unavailable' }, { status: 'sign-in-required' }] as const) {
  test(`Given an activation result ${result.status}, when the form is posted, then no tenant is requested`, async () => {
    const world = setup();
    world.activation.activate = async () => result;
    await world.routes.handle(post());
    assert.deepEqual(world.tenants.events, ['place']);
  });
}

for (const outcome of ['full', 'unavailable', 'exception'] as const) {
  test(`Given a tenant request that is ${outcome} after confirmed creation, when the form is posted, then Quick start still opens and only a failed request reports to the operator`, async () => {
    const world = setup();
    world.tenants.requestAnswer = outcome === 'exception' ? new Error('private registry detail') : outcome;

    const answer = await world.routes.handle(post());

    assert.equal(answer.status, 303);
    assert.equal(answer.headers.get('Location'), 'https://thermus.example/quick-start');
    assert.deepEqual(world.selections, ['org_new']);
    assert.deepEqual(world.failures, outcome === 'full' ? [] : ['Hosted signup could not request the tenant of the new organization. Its first workspace status read requests it again.']);
  });
}
