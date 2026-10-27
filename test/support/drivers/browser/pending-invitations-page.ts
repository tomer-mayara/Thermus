import { parseHTML } from 'linkedom';

// Reads the pending email and role facts shown by the Members page.
export function pendingInvitationsIn(body: string): readonly { readonly email: string; readonly role: string }[] {
  return [...parseHTML(body).document.querySelectorAll('.pending-invitations .invitation-row')].map(row => ({
    email: row.querySelector('.invitation-email')?.textContent ?? '',
    role: row.querySelector('.invitation-role')?.lastChild?.textContent?.trim() ?? '',
  }));
}
