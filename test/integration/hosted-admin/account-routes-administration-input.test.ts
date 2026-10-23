import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accountRequest, assertPage, publicOrigin } from './fixtures/account-routes-fixtures.ts';
import { annToken, changePost, serveAdministration, sessionCookies, validChanges } from './fixtures/administration-routes-fixtures.ts';

const changes = Object.entries(validChanges);
const forgedPage = /The form is not from this site or is no longer valid\./;

function withoutToken(fields: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).filter(([name]) => name !== 'csrf_token'));
}

describe('HostedAccountRoutes input checks of invitation changes', () => {
  for (const [label, origin] of [['a foreign origin', 'https://evil.example'], ['a null origin', 'null'], ['another scheme', 'http://thermus.example'], ['no origin', undefined]] as const) {
    test(`Given change posts with ${label}, when they arrive, then each gets 403 with the session cookies, its body stays unread, and the service is not asked`, async () => {
      const { routes, organizations } = serveAdministration();

      for (const [, { path, fields }] of changes) {
        const request = accountRequest(path, 'session=ann', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(origin === undefined ? {} : { Origin: origin }) },
          body: new URLSearchParams(fields).toString(),
        });
        await assertPage(await routes.handle(request), { status: 403, text: forgedPage, cookies: sessionCookies });
        assert.equal(request.bodyUsed, false);
      }

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  for (const [label, token] of [['no form token', undefined], ['an empty form token', ''], ['the form token of another session', 'csrf-token-of-user-ben'], ['a longer form token', `${annToken}x`]] as const) {
    test(`Given change posts with ${label}, also with an unknown field, when they arrive, then each gets 403 and the service is not asked`, async () => {
      const { routes, organizations } = serveAdministration();

      for (const [, { path, fields }] of changes) {
        const sent = token === undefined ? withoutToken(fields) : { ...fields, csrf_token: token, extra: 'field' };
        await assertPage(await routes.handle(changePost(path, sent)), { status: 403, text: forgedPage, cookies: sessionCookies });
      }

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  test('Given change posts with two form tokens, or a session without a form token, when they arrive, then each gets 403 and the service is not asked', async () => {
    const doubled = serveAdministration();
    const empty = serveAdministration({}, { session: { csrfToken: '' } });

    for (const [, { path, fields }] of changes) {
      const twoTokens = `${new URLSearchParams(fields).toString()}&csrf_token=${annToken}`;
      assert.equal((await doubled.routes.handle(changePost(path, twoTokens))).status, 403);
      assert.equal((await empty.routes.handle(changePost(path, { ...fields, csrf_token: '' }))).status, 403);
    }

    assert.deepEqual([doubled.organizations.administrationCalls, empty.organizations.administrationCalls], [[], []]);
  });

  for (const [name, { path, fields }] of changes) {
    const fieldNames = Object.keys(fields).filter((field) => field !== 'csrf_token');
    const invalid: ReadonlyArray<[string, string]> = [
      ...fieldNames.map((field): [string, string] => [`no ${field}`, new URLSearchParams(Object.entries(fields).filter(([key]) => key !== field)).toString()]),
      ...fieldNames.map((field): [string, string] => [`two ${field} fields`, `${new URLSearchParams(fields).toString()}&${field}=${encodeURIComponent(fields[field as keyof typeof fields])}`]),
      ...fieldNames.map((field): [string, string] => [`an empty ${field}`, new URLSearchParams({ ...fields, [field]: '' }).toString()]),
      ...fieldNames.filter((field) => field !== 'email').map((field): [string, string] => [`a ${field} with a space`, new URLSearchParams({ ...fields, [field]: 'a b' }).toString()]),
      ...fieldNames.filter((field) => field !== 'email').map((field): [string, string] => [`a very long ${field}`, new URLSearchParams({ ...fields, [field]: 'x'.repeat(257) }).toString()]),
      ['an unknown field', new URLSearchParams({ ...fields, organization_name: 'Renamed' }).toString()],
    ];
    test(`Given a ${name} post with a missing, repeated, empty, spaced, or very long field, or an unknown field, when it arrives, then it gets 400 with the session cookies, and the service is not asked`, async () => {
      const { routes, organizations } = serveAdministration();

      for (const [label, body] of invalid) {
        const response = await routes.handle(changePost(path, body));
        assert.equal(response.status, 400, label);
        await assertPage(response, { status: 400, text: /The request is not valid\./, cookies: sessionCookies });
      }

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  for (const email of ['no-at-sign.example.com', 'two@at@example.com', 'space in@example.com', 'line\nbreak@example.com', '@example.com', 'nobody@', `${'a'.repeat(250)}@example.com`]) {
    test(`Given an invitation post with the address ${JSON.stringify(email.length > 40 ? `${email.slice(0, 12)}…` : email)}, when it arrives, then it gets 400, and nothing is sent`, async () => {
      const { routes, organizations } = serveAdministration();

      assert.equal((await routes.handle(changePost('/invitations/send', { ...validChanges.send.fields, email }))).status, 400);

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }

  test('Given change posts for another organization than the one of the session, when they arrive, then each is out of date with 409, and the service is not asked', async () => {
    const { routes, organizations } = serveAdministration();

    for (const [, { path, fields }] of changes) {
      await assertPage(await routes.handle(changePost(path, { ...fields, organization_id: 'org-b' })), { status: 409, text: /changed after the page was shown/, cookies: sessionCookies });
    }

    assert.deepEqual(organizations.administrationCalls, []);
  });

  test('Given change posts with JSON or larger than 16 KiB, when they arrive, then they get 415 or 413, and the service is not asked', async () => {
    const { routes, organizations } = serveAdministration();

    for (const [, { path, fields }] of changes) {
      const json = changePost(path, JSON.stringify(fields), { 'Content-Type': 'application/json' });
      const large = changePost(path, `${new URLSearchParams(fields).toString()}&padding=${'x'.repeat(16 * 1024)}`);
      await assertPage(await routes.handle(json), { status: 415, text: /This page accepts only HTML form data\./, cookies: sessionCookies });
      await assertPage(await routes.handle(large), { status: 413, text: /The form data is too large\./, cookies: sessionCookies });
    }

    assert.deepEqual(organizations.administrationCalls, []);
  });

  for (const method of ['GET', 'PUT']) {
    test(`Given a ${method} request, when it reaches a change route, then it gets 405 with Allow: POST, and the service is not asked`, async () => {
      const { routes, organizations } = serveAdministration();

      for (const [, { path }] of changes) {
        const response = await routes.handle(accountRequest(path, 'session=ann', { method, headers: { Origin: publicOrigin } }));
        assert.equal(response.headers.get('Allow'), 'POST');
        await assertPage(response, { status: 405, text: /This page does not accept this request method\./, cookies: sessionCookies });
      }

      assert.deepEqual(organizations.administrationCalls, []);
    });
  }
});
