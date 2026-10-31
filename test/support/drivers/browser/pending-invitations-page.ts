import { parseHTML } from 'linkedom';

export function pendingInvitationsIn(body: string): readonly { readonly email: string; readonly role: string }[] {
  return [...parseHTML(body).document.querySelectorAll('.pending-invitations .invitation-row')].map(row => ({
    email: row.querySelector('.invitation-email')?.textContent ?? '',
    role: row.querySelector('.invitation-role')?.lastChild?.textContent?.trim() ?? '',
  }));
}
