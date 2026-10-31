import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { formsIn, type BrowserAnswer, type HostedBrowser, type PageForm } from '../../support/drivers/browser/hosted-browser.ts';
import { signInThroughServer } from '../../support/dsl/workos-sign-in.ts';
import { removalForm } from '../../support/dsl/hosted-member-removal.ts';
import { otherOrganization, remainingAdmin, removalAdmin, removalOrganization, removalUser, serveMemberRemovalSite } from '../../support/in-process/hosted-member-removal-site.ts';

test('Given a password-authenticated Admin, two active Admins, and an ordinary User, when the Admin confirms Remove through Members, then only that membership is removed and the current count is two', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.setRoles(remainingAdmin, removalOrganization, ['user', 'admin']) });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const form = await removalForm(browser, targetId);

  const answer = await browser.submit(form);

  assert.ok(answer.status < 400, answer.body);
  assert.deepEqual([...site.world.deletedMembershipIds], [targetId]);
  assert.equal(site.removalStore.operations.get(removalOrganization)?.outcome, 'applied');
  const refreshed = await browser.open('members');
  assert.equal(refreshed.status, 200, refreshed.body);
  assert.match(refreshed.body, /Active product members: 2/);
  assert.doesNotMatch(refreshed.body, /user@example\.com/);
});

interface Removal {
  readonly site: Awaited<ReturnType<typeof serveMemberRemovalSite>>;
  readonly browser: HostedBrowser;
  readonly form: PageForm;
  readonly targetId: string;
}
type Submission = () => Promise<BrowserAnswer>;

const submitted = ({ browser, form }: Removal): Submission => () => browser.submit(form);
const forged = ({ browser, form }: Removal, field: string, value: string): Submission => () => browser.submit({ ...form, fields: { ...form.fields, [field]: value } });

const invalidRemovals: Readonly<Record<string, (removal: Removal) => Submission | Promise<Submission>>> = {
  'actor authority changed': (removal) => {
    removal.site.world.setRoles(removalAdmin, removalOrganization, ['user']);
    return submitted(removal);
  },
  'saved organization stale': async (removal) => {
    const choice = formsIn((await removal.browser.open('organizations')).body).find(each => each.fields.organization_id === otherOrganization);
    assert.ok(choice);
    assert.equal((await removal.browser.submit(choice)).status, 303);
    return submitted(removal);
  },
  'organization forged': (removal) => forged(removal, 'organization_id', 'org_FORGED'),
  'saved target stale': (removal) => {
    removal.site.world.deletedMembershipIds.add(removal.targetId);
    return submitted(removal);
  },
  'target forged': (removal) => forged(removal, 'membership_id', 'om_FORGED'),
  'revision stale': (removal) => {
    removal.site.world.setRoles(removalUser, removalOrganization, ['admin']);
    return submitted(removal);
  },
  'revision forged': (removal) => forged(removal, 'revision', 'forged'),
  'method invalid': ({ browser, form }) => () => browser.open(form.action),
  'origin invalid': ({ browser, form }) => () => browser.submit(form, { origin: 'https://forged.example' }),
  'CSRF invalid': (removal) => forged(removal, 'csrf_token', 'forged'),
};

for (const [invalid, prepare] of Object.entries(invalidRemovals)) {
  test(`Given a valid removable target and only ${invalid}, when the removal form is submitted, then no provider deletion occurs`, async (t) => {
    const site = await serveMemberRemovalSite(t, { setUp: world => {
      world.memberships = [...world.memberships, { userId: removalAdmin.id, organizationId: otherOrganization, roles: ['admin'], directoryManaged: false }];
    } });
    const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
    const targetId = site.world.membershipId(removalUser, removalOrganization);
    const submit = await prepare({ site, browser, form: await removalForm(browser, targetId), targetId });
    site.world.fake.takeRequests();

    const answer = await submit();

    assert.ok(answer.status >= 400, answer.body);
    assert.deepEqual(site.world.fake.takeRequests().filter(request => request.method === 'DELETE'), []);
    assert.equal(site.removalStore.operations.get(removalOrganization)?.outcome === 'applied', false);
  });
}

test('Given a password-only last Admin and a valid self-removal form, when Remove is confirmed, then the page asks for another Admin and links to invitations without deleting the membership', async (t) => {
  const site = await serveMemberRemovalSite(t, { setUp: world => world.setRoles(remainingAdmin, removalOrganization, ['user']) });
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const form = await removalForm(browser, site.world.membershipId(removalAdmin, removalOrganization));

  const answer = await browser.submit(form);

  assert.equal(answer.status, 409, answer.body);
  assert.match(answer.body, /another Admin/i);
  assert.match(answer.body, /href="[^\"]*invitations[^\"]*"/);
  assert.equal(site.world.deletedMembershipIds.size, 0);
  assert.doesNotMatch(answer.body, /MFA|authenticator|verification code/i);
});

test('Given an uncertain removal that deleted its target, when the Admin repeats the same POST and refreshes Members, then the POST is busy, current facts are shown, and no deletion is replayed', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const targetId = site.world.membershipId(removalUser, removalOrganization);
  const form = await removalForm(browser, targetId);
  site.world.fake.answer(`DELETE /user_management/organization_memberships/${targetId}`, () => { site.world.deletedMembershipIds.add(targetId); return 'close'; });
  site.world.fake.takeRequests();

  const uncertain = await browser.submit(form);
  const held = structuredClone(site.removalStore.operations.get(removalOrganization));
  const repeated = await browser.submit(form);
  const current = await browser.open('members');

  assert.equal(uncertain.status, 503, uncertain.body);
  assert.match(uncertain.body, /not confirmed|unconfirmed/i);
  assert.deepEqual(formsIn(uncertain.body), []);
  assert.equal(repeated.status, 409, repeated.body);
  assert.match(repeated.body, /progress|busy|pending/i);
  assert.equal(current.status, 200, current.body);
  assert.doesNotMatch(current.body, /user@example\.com/);
  const currentPage = parseHTML(current.body).document;
  const help = currentPage.querySelector('details[data-help="members"]');
  assert.ok(help);
  help.remove();
  const currentContent = currentPage.querySelector('main');
  assert.ok(currentContent);
  assert.equal(currentContent.querySelector('h1')?.textContent, 'Members · 2');
  assert.doesNotMatch(currentContent.textContent ?? '', /removal (is|was) confirmed|member removed/i);
  assert.deepEqual(site.removalStore.operations.get(removalOrganization), held);
  assert.equal(site.removalStore.admissions.length, 1);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
});

test('Given a confirmed removal followed by failed Members reads, when the Admin refreshes, then completion remains separate from the read failure and no deletion is replayed', async (t) => {
  const site = await serveMemberRemovalSite(t);
  const { browser } = await signInThroughServer(site, removalAdmin, removalOrganization);
  const form = await removalForm(browser, site.world.membershipId(removalUser, removalOrganization));
  site.world.fake.takeRequests();

  const applied = await browser.submit(form);
  site.world.membershipOutage = { status: 503, body: { message: 'private read failure' } };
  const refresh = await browser.open('members');

  assert.equal(applied.status, 200, applied.body);
  assert.match(applied.body, /removed/i);
  assert.deepEqual(formsIn(applied.body), []);
  assert.equal(refresh.status, 500, refresh.body);
  assert.deepEqual(formsIn(refresh.body), []);
  assert.doesNotMatch(refresh.body, /private read failure/);
  assert.equal(site.world.fake.takeRequests().filter(request => request.method === 'DELETE').length, 1);
});
