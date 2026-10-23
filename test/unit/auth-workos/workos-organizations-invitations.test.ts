import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InvitationState } from '../../../src/accounts/organizations/organization-directory.ts';
import {
  acme,
  assertWorkOSFailure,
  globex,
  invitation,
  notFound,
  now,
  refusal,
  WorkOSOrganizationsDouble,
  type InvitationRecord,
} from './fixtures/workos-organizations-double.ts';

const bob = invitation({ id: 'invitation_01BOB', email: 'bob@example.com', roleSlug: 'user' });
const carol = invitation({ id: 'invitation_02CAROL', email: 'carol@example.com', roleSlug: 'admin', state: 'accepted' });
const dan = invitation({ id: 'invitation_03DAN', email: 'dan@example.com', state: 'revoked' });
const eve = invitation({ id: 'invitation_04EVE', email: 'eve@example.com', state: 'expired', expiresAt: '2026-10-01T12:00:00.000Z' });
// WorkOS can still give the state pending after the expiry time.
const fay = invitation({ id: 'invitation_05FAY', email: 'fay@example.com', expiresAt: '2026-10-14T11:59:59.999Z' });
const credentials = /invitation-token|invitation_token|auth\.example/;

// WorkOS with these invitations on one page, each also readable by its ID.
function doubleWith(records: readonly InvitationRecord[], after: string | null = null): WorkOSOrganizationsDouble {
  const double = new WorkOSOrganizationsDouble();
  double.invitationList = { data: records, after };
  for (const record of records) double.invitations.set(record.id, record);
  return double;
}

describe('WorkOSOrganizations invitation pages', () => {
  test('Given invitations in each state on a page with a next cursor, when the pending and revoked invitations are read with a cursor, then WorkOS gets one invitation read of the organization with the limit 100 and the cursor, and the frozen page keeps only the pending and revoked invitations, each with only its ID, organization, address, role, and state', async () => {
    const double = doubleWith([bob, carol, dan, eve], 'invitation_04EVE');

    const page = await double.directory().invitationPage({ organizationId: acme, states: ['pending', 'revoked'], cursor: 'invitation_00START' });

    assert.deepEqual(double.calls, [{ method: 'listInvitations', input: { organizationId: acme, limit: 100, after: 'invitation_00START' } }]);
    assert.deepEqual(page, {
      items: [
        { invitationId: 'invitation_01BOB', organizationId: acme, email: 'bob@example.com', role: 'user', state: 'pending', expiresAt: bob.expiresAt },
        { invitationId: 'invitation_03DAN', organizationId: acme, email: 'dan@example.com', role: 'user', state: 'revoked', expiresAt: dan.expiresAt },
      ],
      next: 'invitation_04EVE',
    });
    assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items) && page.items.every((item) => Object.isFrozen(item)));
    assert.doesNotMatch(JSON.stringify(page), credentials);
  });

  test('Given each state, when the invitations of all four states are read, then each invitation keeps the state of WorkOS, and the accepted invitation keeps its role', async () => {
    const double = doubleWith([bob, carol, dan, eve]);

    const page = await double.directory().invitationPage({ organizationId: acme, states: ['pending', 'accepted', 'revoked', 'expired'] });

    assert.deepEqual(page.items.map(({ email, role, state }) => `${email} ${role} ${state}`), [
      'bob@example.com user pending',
      'carol@example.com admin accepted',
      'dan@example.com user revoked',
      'eve@example.com user expired',
    ]);
  });

  test('Given pending invitations whose expiry time is before, at, and after the clock time, when the expired and then the pending invitations are read, then the first two count as expired and only the last one stays pending', async () => {
    const atClock = invitation({ id: 'invitation_06GUS', email: 'gus@example.com', expiresAt: now.toISOString() });
    const double = doubleWith([fay, atClock, bob]);
    const directory = double.directory();

    const expired = await directory.invitationPage({ organizationId: acme, states: ['expired'] });
    const pending = await directory.invitationPage({ organizationId: acme, states: ['pending'] });

    assert.deepEqual(expired.items.map(({ invitationId, state }) => `${invitationId} ${state}`), ['invitation_05FAY expired', 'invitation_06GUS expired']);
    assert.deepEqual(pending.items.map(({ invitationId, state }) => `${invitationId} ${state}`), ['invitation_01BOB pending']);
  });

  test('Given a pending invitation, when the clock passes its expiry time between two reads, then the first read gives pending and the second expired, because each read asks the clock again', async () => {
    let time = new Date('2026-10-21T11:59:59.000Z');
    const double = doubleWith([bob]);
    const directory = double.directory(() => time);

    const before = await directory.invitationPage({ organizationId: acme, states: ['pending', 'expired'] });
    time = new Date('2026-10-21T12:00:00.000Z');
    const after = await directory.invitationPage({ organizationId: acme, states: ['pending', 'expired'] });

    assert.deepEqual([before.items[0]?.state, after.items[0]?.state], ['pending', 'expired']);
  });

  for (const after of [null, '']) {
    test(`Given the last page, with the WorkOS cursor ${JSON.stringify(after)}, when the invitations are read, then the page has no next cursor`, async () => {
      const double = doubleWith([bob], after);

      const page = await double.directory().invitationPage({ organizationId: acme, states: ['pending'] });

      assert.equal(page.items.length, 1);
      assert.equal('next' in page, false);
    });
  }

  test('Given an empty page, when the invitations are read without a cursor, then the WorkOS read has no after cursor, and the page is empty and frozen', async () => {
    const double = doubleWith([]);

    const page = await double.directory().invitationPage({ organizationId: acme, states: ['pending'] });

    assert.deepEqual(page, { items: [] });
    assert.ok(Object.isFrozen(page) && Object.isFrozen(page.items));
    assert.deepEqual(double.calls, [{ method: 'listInvitations', input: { organizationId: acme, limit: 100 } }]);
  });

  test('Given a read that names no state, when the invitations are read, then the read fails before any WorkOS call', async () => {
    const double = doubleWith([bob]);

    await assertWorkOSFailure(double.directory().invitationPage({ organizationId: acme, states: [] }), /state/);
    assert.deepEqual(double.calls, []);
  });

  for (const { label, record } of [
    { label: 'an invitation of another organization', record: invitation({ id: 'invitation_07GLOBEX', organizationId: globex, state: 'accepted' }) },
    { label: 'an invitation without an organization', record: invitation({ id: 'invitation_08APP', organizationId: null, roleSlug: null, state: 'accepted' }) },
  ]) {
    test(`Given WorkOS answers ${label}, also in a state that the read does not name, when the pending invitations are read, then the read fails and gives no invitation`, async () => {
      const double = doubleWith([bob, record]);

      await assertWorkOSFailure(double.directory().invitationPage({ organizationId: acme, states: ['pending'] }), /did not ask for/);
    });
  }

  for (const roleSlug of [null, '']) {
    test(`Given an invitation whose role is ${JSON.stringify(roleSlug)} in a state that the read names, when the invitations are read, then the read fails, because no role means no known grant`, async () => {
      const double = doubleWith([bob, invitation({ id: 'invitation_09NOROLE', email: 'hal@example.com', roleSlug })]);

      await assertWorkOSFailure(double.directory().invitationPage({ organizationId: acme, states: ['pending'] }), /without a role/);
    });
  }

  test('Given an accepted invitation without a role, when only the pending invitations are read, then the read keeps only the pending invitation, because it does not use the role of another state', async () => {
    const double = doubleWith([bob, invitation({ id: 'invitation_09NOROLE', email: 'hal@example.com', roleSlug: null, state: 'accepted' })]);

    const page = await double.directory().invitationPage({ organizationId: acme, states: ['pending'] });

    assert.deepEqual(page.items.map(({ invitationId }) => invitationId), ['invitation_01BOB']);
  });

  test('Given a pending invitation without a valid expiry time, when the invitations are read, then the read fails, because its state is not known', async () => {
    const double = doubleWith([invitation({ expiresAt: 'not a time' })]);

    await assertWorkOSFailure(double.directory().invitationPage({ organizationId: acme, states: ['pending', 'expired'] }), /expiry/);
  });

  test('Given an invitation read that fails, when the invitations are read, then the same error reaches the caller, so that a failure never looks like an organization without invitations', async () => {
    const failure = refusal('server_error', 503);
    const double = doubleWith([bob]);
    double.failures.set('listInvitations', failure);

    await assert.rejects(double.directory().invitationPage({ organizationId: acme, states: ['pending'] }), (error) => error === failure);
  });
});

describe('WorkOSOrganizations invitation', () => {
  test('Given an invitation of Globex, when it is read by its ID, then it is the frozen invitation with only its ID, organization, address, role, and state, after one read; the directory reads any organization, because the service checks the organization', async () => {
    const double = doubleWith([invitation({ id: 'invitation_10GLOBEX', organizationId: globex, roleSlug: 'admin' })]);

    const result = await double.directory().invitation('invitation_10GLOBEX');

    assert.deepEqual(result, { invitationId: 'invitation_10GLOBEX', organizationId: globex, email: 'bob@example.com', role: 'admin', state: 'pending', expiresAt: bob.expiresAt });
    assert.ok(Object.isFrozen(result));
    assert.doesNotMatch(JSON.stringify(result), credentials);
    assert.deepEqual(double.calls, [{ method: 'getInvitation', input: 'invitation_10GLOBEX' }]);
  });

  test('Given a pending invitation whose expiry time has passed, when it is read by its ID, then its state is expired', async () => {
    const double = doubleWith([fay]);

    assert.equal((await double.directory().invitation('invitation_05FAY'))?.state, 'expired');
  });

  test('Given WorkOS answers 404 for the invitation, when it is read by its ID, then the invitation is undefined', async () => {
    const double = doubleWith([]);

    assert.equal(await double.directory().invitation('invitation_99GONE'), undefined);
    assert.deepEqual(double.methods(), ['getInvitation']);
  });

  test('Given an invitation without an organization, when it is read by its ID, then the invitation is undefined, because it is not an organization invitation', async () => {
    const double = doubleWith([invitation({ organizationId: null, roleSlug: null })]);

    assert.equal(await double.directory().invitation('invitation_01BOB'), undefined);
  });

  test('Given WorkOS answers an invitation with another ID, when an invitation is read, then the read fails', async () => {
    const double = doubleWith([]);
    double.invitations.set('invitation_01BOB', invitation({ id: 'invitation_02OTHER' }));

    await assertWorkOSFailure(double.directory().invitation('invitation_01BOB'), /did not ask for/);
  });

  test('Given an organization invitation without a role, when it is read by its ID, then the read fails', async () => {
    const double = doubleWith([invitation({ roleSlug: null })]);

    await assertWorkOSFailure(double.directory().invitation('invitation_01BOB'), /without a role/);
  });

  for (const { label, failure } of [
    { label: '500', failure: refusal('server_error', 500) },
    { label: '400', failure: refusal('invalid_request', 400) },
  ]) {
    test(`Given an invitation read that fails with ${label}, when an invitation is read, then the same error reaches the caller, because only a 404 means no invitation`, async () => {
      const double = doubleWith([bob]);
      double.failures.set('getInvitation', failure);

      await assert.rejects(double.directory().invitation('invitation_01BOB'), (error) => error === failure);
    });
  }
});

describe('WorkOSOrganizations invitation sends', () => {
  const request = { organizationId: acme, email: 'new@example.com', role: 'user' } as const;

  test('Given a new address, when a User invitation is sent, then WorkOS gets one send with exactly the address, the organization, and the one role, and the result is a frozen applied', async () => {
    const double = doubleWith([]);

    const result = await double.directory().sendInvitation(request);

    assert.deepEqual(result, { outcome: 'applied' });
    assert.ok(Object.isFrozen(result));
    assert.deepEqual(double.calls, [{ method: 'sendInvitation', input: { email: 'new@example.com', organizationId: acme, roleSlug: 'user' } }]);
  });

  test('Given WorkOS answers the send with the address in another letter case, when an Admin invitation is sent, then the result is applied, because addresses compare without letter case', async () => {
    const double = doubleWith([]);
    double.changeAnswers.set('sendInvitation', invitation({ email: 'NEW@Example.com', roleSlug: 'admin' }));

    assert.deepEqual(await double.directory().sendInvitation({ ...request, role: 'admin' }), { outcome: 'applied' });
  });

  for (const code of ['email_already_invited_to_organization', 'user_already_organization_member']) {
    test(`Given WorkOS refuses the send with 400 ${code}, when an invitation is sent, then the result is a frozen address-in-use after the one send`, async () => {
      const double = doubleWith([]);
      double.failures.set('sendInvitation', refusal(code, 400));

      const result = await double.directory().sendInvitation(request);

      assert.deepEqual(result, { outcome: 'address-in-use' });
      assert.ok(Object.isFrozen(result));
      assert.deepEqual(double.methods(), ['sendInvitation']);
    });
  }

  for (const { label, failure } of [
    { label: 'WorkOS refuses the send with 400 invalid_role', failure: refusal('invalid_role', 400) },
    { label: 'WorkOS refuses the send with 422 user_already_organization_member', failure: refusal('user_already_organization_member', 422) },
    { label: 'WorkOS fails the send with 500', failure: refusal('server_error', 500) },
    { label: 'the send gets no answer', failure: new Error('fetch failed') },
  ]) {
    test(`Given ${label}, when an invitation is sent, then the same error reaches the caller`, async () => {
      const double = doubleWith([]);
      double.failures.set('sendInvitation', failure);

      await assert.rejects(double.directory().sendInvitation(request), (error) => error === failure);
    });
  }

  for (const { label, answer } of [
    { label: 'an invitation of another organization', answer: invitation({ email: 'new@example.com', organizationId: globex }) },
    { label: 'an invitation for another role', answer: invitation({ email: 'new@example.com', roleSlug: 'admin' }) },
    { label: 'an invitation to another address', answer: invitation({ email: 'other@example.com' }) },
    { label: 'an invitation that is not pending', answer: invitation({ email: 'new@example.com', state: 'revoked' }) },
  ]) {
    test(`Given WorkOS answers the send with ${label}, when an invitation is sent, then the send fails, because the send happened and its effect is not known`, async () => {
      const double = doubleWith([]);
      double.changeAnswers.set('sendInvitation', answer);

      await assertWorkOSFailure(double.directory().sendInvitation(request), /did not ask for/);
    });
  }
});

describe('WorkOSOrganizations invitation resends and revokes', () => {
  const changes = [
    { change: 'resend', method: 'resendInvitation', stateAfter: 'pending' },
    { change: 'revoke', method: 'revokeInvitation', stateAfter: 'revoked' },
  ] as const;

  function changeOf(double: WorkOSOrganizationsDouble, change: 'resend' | 'revoke', invitationId = 'invitation_01BOB') {
    const directory = double.directory();
    return change === 'resend' ? directory.resendInvitation(invitationId) : directory.revokeInvitation(invitationId);
  }

  for (const { change, method, stateAfter } of changes) {
    test(`Given a pending invitation, when a ${change} is asked for, then WorkOS gets one ${method} of it, its state is ${stateAfter}, and the result is a frozen applied`, async () => {
      const double = doubleWith([bob]);

      const result = await changeOf(double, change);

      assert.deepEqual(result, { outcome: 'applied' });
      assert.ok(Object.isFrozen(result));
      assert.deepEqual(double.calls, [{ method, input: 'invitation_01BOB' }]);
      assert.equal(double.invitations.get('invitation_01BOB')?.state, stateAfter);
    });
  }

  for (const { change, method, code, state } of [
    { change: 'resend', method: 'resendInvitation', code: 'invite_revoked', state: 'revoked' },
    { change: 'resend', method: 'resendInvitation', code: 'invite_accepted', state: 'accepted' },
    { change: 'resend', method: 'resendInvitation', code: 'invite_expired', state: 'expired' },
    { change: 'revoke', method: 'revokeInvitation', code: 'invite_not_pending', state: 'accepted' },
    { change: 'revoke', method: 'revokeInvitation', code: 'invite_not_pending', state: 'revoked' },
    { change: 'revoke', method: 'revokeInvitation', code: 'invite_not_pending', state: 'expired' },
  ] as const satisfies readonly { change: string; method: string; code: string; state: InvitationState }[]) {
    test(`Given WorkOS refuses a ${change} with 400 ${code} and the invitation is now ${state}, when the ${change} is asked for, then the result is a frozen not-pending after one read of the invitation`, async () => {
      const double = doubleWith([invitation({ state })]);
      double.failures.set(method, refusal(code, 400));

      const result = await changeOf(double, change);

      assert.deepEqual(result, { outcome: 'not-pending' });
      assert.ok(Object.isFrozen(result));
      assert.deepEqual(double.calls, [{ method, input: 'invitation_01BOB' }, { method: 'getInvitation', input: 'invitation_01BOB' }]);
    });
  }

  for (const { change, method } of changes) {
    test(`Given WorkOS refuses a ${change} with 400 and the invitation is still pending by state but its expiry time has passed, when the ${change} is asked for, then the result is not-pending`, async () => {
      const double = doubleWith([invitation({ expiresAt: '2026-10-14T11:00:00.000Z' })]);
      double.failures.set(method, refusal('invite_expired', 400));

      assert.deepEqual(await changeOf(double, change), { outcome: 'not-pending' });
    });

    for (const { label, setUp } of [
      { label: 'the invitation is still pending', setUp: (double: WorkOSOrganizationsDouble) => double.invitations.set('invitation_01BOB', bob) },
      { label: 'WorkOS answers 404 for the invitation', setUp: (double: WorkOSOrganizationsDouble) => double.invitations.clear() },
    ]) {
      test(`Given WorkOS refuses a ${change} with 400 and ${label}, when the ${change} is asked for, then the original error reaches the caller after one read`, async () => {
        const failure = refusal('invalid_request', 400);
        const double = doubleWith([]);
        setUp(double);
        double.failures.set(method, failure);

        await assert.rejects(changeOf(double, change), (error) => error === failure);
        assert.deepEqual(double.methods(), [method, 'getInvitation']);
      });
    }

    for (const { label, failure } of [
      { label: '500', failure: refusal('server_error', 500) },
      { label: '404', failure: notFound() },
    ]) {
      test(`Given a ${change} that fails with ${label}, when the ${change} is asked for, then the same error reaches the caller without another read`, async () => {
        const double = doubleWith([invitation({ state: 'revoked' })]);
        double.failures.set(method, failure);

        await assert.rejects(changeOf(double, change), (error) => error === failure);
        assert.deepEqual(double.methods(), [method]);
      });
    }

    for (const { label, answer } of [
      { label: 'another invitation', answer: invitation({ id: 'invitation_02OTHER', state: change === 'resend' ? 'pending' : 'revoked' }) },
      { label: `an invitation that is not ${change === 'resend' ? 'pending' : 'revoked'}`, answer: invitation({ state: change === 'resend' ? 'revoked' : 'pending' }) },
    ]) {
      test(`Given WorkOS answers a ${change} with ${label}, when the ${change} is asked for, then the change fails, because its effect is not known`, async () => {
        const double = doubleWith([bob]);
        double.changeAnswers.set(method, answer);

        await assertWorkOSFailure(changeOf(double, change), /did not ask for/);
      });
    }
  }
});

describe('WorkOSOrganizations invitation identity policy', () => {
  test('Given the WorkOS directory, when its invitation identity policy is read, then it is provider-rules, because WorkOS can accept a sign-in with another address of the same domain', () => {
    assert.equal(new WorkOSOrganizationsDouble().directory().invitationIdentityPolicy, 'provider-rules');
  });
});
