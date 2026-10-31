import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileNameOf } from '../../../src/accounts/providers/workos/workos-auth-provider.ts';

const subject = 'user-1';

for (const [label, profile, expected] of [
  ['a native name with split parts', { id: subject, name: '  Native Name  ', firstName: 'ignored', lastName: 'ignored' }, '  Native Name  '],
  ['a native name with a control character', { id: subject, name: 'bad\nname', firstName: 'Valid' }, 'bad\nname'],
  ['a native name of control characters only', { id: subject, name: '\n', firstName: 'Valid' }, '\n'],
  ['a null native name and two split parts', { id: subject, name: null, firstName: ' First ', lastName: ' Last ' }, 'First Last'],
  ['an empty native name and one split part', { id: subject, name: '', firstName: null, lastName: 'Last' }, 'Last'],
  ['no native name and a first name', { id: subject, firstName: 'First' }, 'First'],
] as const) {
  test(`Given a profile of the subject with ${label}, when its name is read, then the name follows the precedence rule`, () => {
    assert.equal(profileNameOf(profile, subject), expected);
  });
}

for (const [label, profile] of [
  ['no profile', undefined],
  ['a null profile', null],
  ['a text profile', 'user-1'],
  ['a profile without an ID', { name: 'Name' }],
  ['a profile of another user', { id: 'another', name: 'Other' }],
  ['a native name of the wrong type', { id: subject, name: 42, firstName: 'Valid' }],
  ['a blank native name and no split parts', { id: subject, name: '   ' }],
  ['no name data', { id: subject, email: 'private@example.com' }],
  ['a split part with a control character', { id: subject, firstName: 'bad\n', lastName: 'name' }],
  ['a split part of the wrong type', { id: subject, firstName: 42, lastName: 'Name' }],
  ['blank split parts', { id: subject, firstName: '  ', lastName: '' }],
] as const) {
  test(`Given ${label}, when the name is read, then no name is given`, () => {
    assert.equal(profileNameOf(profile, subject), undefined);
  });
}
