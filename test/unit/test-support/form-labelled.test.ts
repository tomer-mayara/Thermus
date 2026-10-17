import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formLabelled, formsIn } from '../../support/drivers/browser/hosted-browser.ts';

const formToken = 'form-token-of-the-session';

// A small invitations page, as the product pages write it: each element on one line. Each form holds the form token of
// the session.
const page = [
  '<h1>Invitations</h1>',
  '<form method="post" action="/team/invitations/send">',
  `<input type="hidden" name="csrf_token" value="${formToken}">`,
  '<input type="hidden" name="organization_id" value="org-a">',
  '<input type="hidden" name="role" value="user">',
  '<button type="submit">Invite as User</button>',
  '</form>',
  '<form method="post" action="/team/invitations/resend">',
  `<input type="hidden" name="csrf_token" value="${formToken}">`,
  '<input type="hidden" name="organization_id" value="org-a">',
  '<input type="hidden" name="invitation_id" value="inv-pia">',
  '<button type="submit">Resend the invitation to pia@example.com</button>',
  '</form>',
].join('\n');

describe('Form of a page by its button text', () => {
  test('Given the forms of a page, when a form is asked for by its button text, then it gives that form with its action and its fields', () => {
    const forms = formsIn(page);

    const invite = formLabelled(forms, 'Invite as User');
    const resend = formLabelled(forms, 'Resend the invitation to pia@example.com');

    assert.deepEqual(invite, {
      action: '/team/invitations/send',
      fields: { csrf_token: formToken, organization_id: 'org-a', role: 'user' },
      label: 'Invite as User',
    });
    assert.deepEqual(resend, {
      action: '/team/invitations/resend',
      fields: { csrf_token: formToken, organization_id: 'org-a', invitation_id: 'inv-pia' },
      label: 'Resend the invitation to pia@example.com',
    });
  });

  test('Given the forms of a page, when no form has the button text, then it fails with an AssertionError that names the text and lists the button texts of the page, and no field value is in the message', () => {
    const forms = formsIn(page);
    const fieldValues = forms.flatMap(({ fields }) => Object.values(fields));

    assert.throws(() => formLabelled(forms, 'Invite as Admin'), (error: unknown) => {
      assert.ok(error instanceof assert.AssertionError, String(error));
      assert.equal(error.message, 'The page offers no form "Invite as Admin": ["Invite as User","Resend the invitation to pia@example.com"]');
      assert.deepEqual(fieldValues.filter((value) => error.message.includes(value)), [], 'The message shows a field value, such as the form token.');
      return true;
    });
  });

  test('Given no form, when a form is asked for by its button text, then it fails with an AssertionError that names the text and lists no button text', () => {
    assert.throws(() => formLabelled([], 'Globex'), { name: 'AssertionError', message: 'The page offers no form "Globex": []' });
  });
});
