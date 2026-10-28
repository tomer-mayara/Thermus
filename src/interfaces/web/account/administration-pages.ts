import { micromark } from 'micromark';
import { membersRemovalHelpDocument } from './administration-help-documents.ts';
import { escapeHtml } from '../html-escape.ts';
import type { InvitationEntry, InvitationOverview, MemberOverview } from '../../../accounts/organizations/administration-overviews.ts';
import type { InvitationIdentityPolicy } from '../../../accounts/organizations/organization-directory.ts';
import { hiddenField, postForm } from '../page-html.ts';
import { membersPageLayout } from './members-page-layout.ts';

const membersHelp = `<details class="administration-help" data-help="members" data-document-version="${membersRemovalHelpDocument.version}" data-document-sha256="${membersRemovalHelpDocument.sha256}">
<summary>Member removal help</summary><div class="administration-help-content">${micromark(membersRemovalHelpDocument.text)
  .replace(/<(\/?)h([1-3])>/g, (_tag: string, closing: string, level: string) => `<${closing}h${Number(level) + 2}>`)}</div></details>`;

export { billingPage } from './billing-page.ts';

export interface MembersPageForm {
  readonly members: MemberOverview;
  readonly invitations: InvitationOverview;
  readonly subject: string;
  readonly csrfToken: string;
  readonly actions: { readonly send: string; readonly resend: string; readonly revoke: string; readonly remove: string };
  readonly navigation: { readonly product: string; readonly members: string; readonly organizations: string; readonly logging?: string; readonly quickStart?: string };
}

const ROLE_LABELS: ReadonlyMap<string, string> = new Map([['user', 'User'], ['admin', 'Admin']]);
// Both complete reads must succeed before this page is rendered. It shows current access and pending invitations.
export function membersPage(form: MembersPageForm): Response {
  const members = form.members.members.filter(({ status }) => status === 'active');
  const invitations = form.invitations.invitations.filter(({ state }) => state === 'pending');
  const memberRows = members.map((member) => `<li class="member-row"><dl class="member-facts"><div class="member-identity"><dt>Member</dt><dd><span class="member-email">${escapeHtml(member.email)}</span>${member.subject === form.subject ? '<span class="you-label">You</span>' : ''}</dd></div><div class="member-role"><dt>Role</dt><dd>${rolesText(member.roles)}</dd></div><div class="member-action"><dt>Action</dt><dd>${member.removable ? removalForm(form, member) : '<span class="list-note">No action available</span>'}</dd></div></dl></li>`);
  const content = `<div class="introduction members-introduction"><p class="eyebrow">Workspace administration</p><h1>Members · ${members.length}</h1>
${sendForm(form).join('\n')}</div>
<div class="member-lists"><section class="members-card" aria-labelledby="active-heading"><h2 id="active-heading">Active members</h2>
<p class="list-note">Active product members: ${form.members.activeUserSeats}</p>${seatLine(form.invitations)}
${members.length === 0 ? '<p>No active members.</p>' : `<ul class="member-list">${memberRows.join('\n')}</ul>`}</section>
<details class="pending-invitations members-card"${invitations.length > 0 ? ' open' : ''}><summary>Pending invitations · ${invitations.length}</summary>
${invitations.length === 0 ? '<p class="list-note">No pending invitations.</p>' : `<ul class="invitation-list">${invitations.map((invitation) => invitationRow(form, invitation)).join('\n')}</ul>`}
</details>${membersHelp}</div>`;
  return membersPageLayout(form.navigation, content, { title: 'Members', current: 'members', organizationName: form.members.organizationName });
}

// The seats of a plan with a member limit count the pending invitations too, so the line stays beside both lists.
function seatLine(invitations: InvitationOverview): string {
  return invitations.seats === undefined ? '' : `\n<p class="list-note">${invitations.seats.used} of ${invitations.seats.limit} seats used</p>`;
}

function removalForm(form: MembersPageForm, member: MemberOverview['members'][number]): string {
  const self = member.subject === form.subject;
  const label = self ? `Leave ${form.members.organizationName}` : `Remove ${member.email}`;
  const disclosureLabel = self ? `Leave ${form.members.organizationName} as ${member.email}` : `Remove ${member.email} from ${form.members.organizationName}`;
  const content = [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.members.organizationId),
    hiddenField('membership_id', member.membershipId),
    hiddenField('revision', member.revision),
    `<p>Remove ${escapeHtml(member.email)} from ${escapeHtml(form.members.organizationName)}? This removes access to this workspace. The account and access to other workspaces remain.</p>`,
  ];
  return `<details class="member-removal"><summary aria-label="${escapeHtml(disclosureLabel)}">${self ? 'Leave…' : 'Remove…'}</summary><div class="removal-confirmation">${postForm(form.actions.remove, content, label).join('\n')}<a href="${escapeHtml(form.navigation.members)}">Cancel</a></div></details>`;
}

function sendForm(form: MembersPageForm): string[] {
  if (form.invitations.invitableRoles.length === 0) return [];
  const roles = form.invitations.invitableRoles.map((role) => `<label class="role-option"><input type="radio" name="role" value="${escapeHtml(role)}"${role === 'user' ? ' checked' : ''} required> ${escapeHtml(roleLabel(role))}</label>`);
  return [
    '<details class="member-invitation"><summary>Invite member</summary>',
    `<section class="invite-card" aria-labelledby="invite-heading"><h2 id="invite-heading">Invite to ${escapeHtml(form.members.organizationName)}</h2>`,
    '<p>User gives product and MCP access. Admin includes product and MCP access and can invite or remove Users and Admins.</p>',
    ...postForm(form.actions.send, [
      hiddenField('csrf_token', form.csrfToken),
      hiddenField('organization_id', form.members.organizationId),
      '<label for="invite-email">Email address</label>',
      '<input id="invite-email" type="email" name="email" autocomplete="email" required maxlength="254">',
      '<fieldset><legend>Role</legend>', ...roles, '</fieldset>',
      `<p class="policy-note">${identityPolicyText(form.invitations.identityPolicy)}</p>`,
    ], 'Send invitation'),
    `<a href="${escapeHtml(form.navigation.members)}">Cancel</a></section></details>`,
  ];
}

function invitationRow(form: MembersPageForm, invitation: InvitationEntry): string {
  const actions = invitation.changes.map((change) => {
    const label = change === 'resend' ? 'Resend' : 'Revoke';
    return `<form method="post" action="${escapeHtml(form.actions[change])}">
${hiddenField('csrf_token', form.csrfToken)}
${hiddenField('organization_id', form.members.organizationId)}
${hiddenField('invitation_id', invitation.invitationId)}
<button type="submit" aria-label="${escapeHtml(`${label} the invitation to ${invitation.email}`)}">${label}</button>
</form>`;
  });
  return `<li class="invitation-row"><p class="invitation-email">${escapeHtml(invitation.email)}</p>
<p class="invitation-role"><span class="invitation-fact-label">Role</span> ${escapeHtml(roleLabel(invitation.role))}</p>
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
