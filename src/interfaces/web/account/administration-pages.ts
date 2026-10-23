import { escapeHtml } from '../html-escape.ts';
import type { InvitationEntry, InvitationOverview, MemberOverview } from '../../../accounts/organizations/administration-overviews.ts';
import type { InvitationIdentityPolicy } from '../../../accounts/organizations/organization-directory.ts';
import { hiddenField, postForm } from '../page-html.ts';
import { membersPageLayout } from './members-page-layout.ts';

export { billingPage } from './billing-page.ts';

export interface MembersPageForm {
  readonly members: MemberOverview;
  readonly invitations: InvitationOverview;
  readonly subject: string;
  readonly csrfToken: string;
  readonly actions: { readonly send: string; readonly resend: string; readonly revoke: string };
  readonly navigation: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging?: string };
}

const ROLE_LABELS: ReadonlyMap<string, string> = new Map([['user', 'User'], ['admin', 'Admin']]);
// Both complete reads must succeed before this page is rendered. It shows current access and pending invitations.
export function membersPage(form: MembersPageForm): Response {
  const members = form.members.members.filter(({ status }) => status === 'active');
  const invitations = form.invitations.invitations.filter(({ state }) => state === 'pending');
  const memberRows = members.map((member) => `<li class="member-row"><p>${escapeHtml(member.email)}: active. Roles: ${rolesText(member.roles)}.</p>${member.subject === form.subject ? '<span class="you-label">You</span>' : ''}</li>`);
  const content = `<div class="introduction"><p class="eyebrow">Workspace administration</p><h1>Members</h1><p>${escapeHtml(form.members.organizationName)}</p></div>
<section class="invite-card" aria-labelledby="invite-heading"><h2 id="invite-heading">Invite to ${escapeHtml(form.members.organizationName)}</h2>
<p>User gives product and MCP access. Admin includes product and MCP access and can invite Users and Admins.</p>
${sendForm(form).join('\n')}
<p class="policy-note">${identityPolicyText(form.invitations.identityPolicy)}</p></section>
<div class="member-lists"><section class="members-card" aria-labelledby="active-heading"><h2 id="active-heading">Active members</h2>
<p class="list-note">Active product members: ${form.members.activeUserSeats}</p>
${members.length === 0 ? '<p>No active members.</p>' : `<ul class="member-list">${memberRows.join('\n')}</ul>`}</section>
<section class="members-card" aria-labelledby="pending-heading"><h2 id="pending-heading">Pending invitations</h2>
${invitations.length === 0 ? '<p class="list-note">No pending invitations.</p>' : `<ul class="invitation-list">${invitations.map((invitation) => invitationRow(form, invitation)).join('\n')}</ul>`}
</section></div>`;
  return membersPageLayout(form.navigation, content);
}

function sendForm(form: MembersPageForm): string[] {
  if (form.invitations.invitableRoles.length === 0) return [];
  const roles = form.invitations.invitableRoles.map((role) => `<label class="role-option"><input type="radio" name="role" value="${escapeHtml(role)}"${role === 'user' ? ' checked' : ''} required> ${escapeHtml(roleLabel(role))}</label>`);
  return postForm(form.actions.send, [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.members.organizationId),
    '<label for="invite-email">Email address</label>',
    '<input id="invite-email" type="email" name="email" autocomplete="email" required maxlength="254">',
    '<fieldset><legend>Role</legend>', ...roles, '</fieldset>',
  ], 'Invite');
}

function invitationRow(form: MembersPageForm, invitation: InvitationEntry): string {
  const actions = invitation.changes.flatMap((change) => postForm(form.actions[change], [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.members.organizationId),
    hiddenField('invitation_id', invitation.invitationId),
  ], `${change === 'resend' ? 'Resend' : 'Revoke'} the invitation to ${invitation.email}`));
  return `<li><p>${escapeHtml(invitation.email)}: ${escapeHtml(roleLabel(invitation.role))} invitation, pending.</p>
<p class="expiry">Expires <time datetime="${escapeHtml(invitation.expiresAt)}">${escapeHtml(invitation.expiresAt.replace('T', ' ').replace(/(?:\.\d+)?Z$/, ' UTC'))}</time></p>
<div class="invitation-actions">${actions.join('\n')}</div></li>`;
}

function roleLabel(role: string): string {
  return ROLE_LABELS.get(role) ?? role;
}

function identityPolicyText(policy: InvitationIdentityPolicy): string {
  return policy === 'invited-address'
    ? 'Only a sign-in with the invited email address can accept the invitation.'
    : 'The sign-in service decides who can accept the invitation. It can accept a sign-in with another address, for example an address of the same domain.';
}

function rolesText(roles: readonly string[]): string {
  return roles.length === 0 ? 'none' : roles.map((role) => escapeHtml(roleLabel(role))).join(', ');
}
