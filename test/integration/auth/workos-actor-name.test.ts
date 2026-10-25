import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkOSAuthProvider } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';

const user = { authority: 'workos:environment', subject: 'user-1', selectedOrganizationId: 'org-1', name: 'forged input' };

function providerWith(profile: unknown, grants: readonly [] | null | Error = []) {
  const calls: string[] = [];
  const options = {
    authority: user.authority, authkitIssuer: 'https://issuer.example', mcpResourceUrl: 'https://resource.example/mcp',
    keySet: async () => { throw new Error('Token verification is outside this resolution test'); },
    grants: { activeGrants: async () => { calls.push('grants'); if (grants instanceof Error) throw grants; return grants ?? undefined; } },
    userManagement: { getUser: async (id: string) => { calls.push(`profile ${id}`); if (profile instanceof Error) throw profile; return profile; } },
  };
  return { provider: new WorkOSAuthProvider(options), calls };
}

for (const [profile, expected] of [
  [{ id: user.subject, name: '  Zoë O’Neil — 李  ', firstName: 'ignored', lastName: 'ignored' }, 'Zoë O’Neil — 李'],
  [{ id: user.subject, name: null, firstName: ' Zoë ', lastName: ' O’Neil ' }, 'Zoë O’Neil'],
  [{ id: user.subject, name: '', firstName: null, lastName: '李' }, '李'],
  [{ id: user.subject, firstName: 'é'.repeat(512) }, 'é'.repeat(512)],
] as const) {
  test(`Given a trusted matching profile with ${expected.length} name characters, when access is resolved, then one profile read follows grants and its name is detached from input`, async () => {
    const { provider, calls } = providerWith(profile);
    const result = await provider.resolve(user);
    assert.ok(result.allowed);
    assert.deepEqual(result.context.user, { ...user, name: expected });
    assert.deepEqual(calls, ['grants', 'profile user-1']);
    assert.ok(Object.isFrozen(result.context.user));
  });
}

for (const [label, profile] of [
  ['unavailable', new Error('private profile failure')], ['missing', undefined], ['null', null], ['wrong user', { id: 'another', name: 'Other' }],
  ['missing name', { id: user.subject, email: 'private@example.com' }], ['blank', { id: user.subject, name: '   ' }],
  ['wrong type', { id: user.subject, name: 42 }], ['malformed', { id: user.subject, name: '\ud800' }],
  ['control', { id: user.subject, name: 'name\u0085line' }], ['trimmed control', { id: user.subject, name: '\nName' }],
  ['oversized', { id: user.subject, name: 'é'.repeat(513) }], ['invalid split', { id: user.subject, firstName: 'bad\n', lastName: 'name' }],
  ['invalid native before valid split', { id: user.subject, name: 'bad\nname', firstName: 'Valid' }],
  ['control-only native before valid split', { id: user.subject, name: '\n', firstName: 'Valid' }],
  ['wrong native type before valid split', { id: user.subject, name: 42, firstName: 'Valid' }],
  ['wrong split type', { id: user.subject, firstName: 42, lastName: 'Name' }],
] as const) {
  test(`Given a ${label} optional profile, when access is resolved, then access and the original identity survive without a client-supplied name`, async () => {
    const { provider } = providerWith(profile);
    const result = await provider.resolve(user);
    assert.ok(result.allowed);
    assert.deepEqual(result.context.user, { authority: user.authority, subject: user.subject, selectedOrganizationId: user.selectedOrganizationId });
  });
}

test('Given missing or failed grants, when access is resolved, then no optional profile read starts and the authorization outcome stays unchanged', async () => {
  const denied = providerWith({ id: user.subject, name: 'Name' }, null);
  assert.deepEqual(await denied.provider.resolve(user), { allowed: false, reason: 'membership-inactive' });
  assert.deepEqual(denied.calls, ['grants']);
  const error = new Error('grants failed');
  const failed = providerWith({ id: user.subject, name: 'Name' }, error);
  await assert.rejects(failed.provider.resolve(user), failure => failure === error);
  assert.deepEqual(failed.calls, ['grants']);
});

test('Given a foreign authority or no organization, when access is resolved, then no grants or optional profile read starts', async () => {
  const { provider, calls } = providerWith({ id: user.subject, name: 'Name' });
  assert.deepEqual(await provider.resolve({ ...user, authority: 'other' }), { allowed: false, reason: 'account-inactive' });
  assert.deepEqual(await provider.resolve({ ...user, selectedOrganizationId: undefined }), { allowed: false, reason: 'organization-required' });
  assert.deepEqual(calls, []);
});
