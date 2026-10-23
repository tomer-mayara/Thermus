import { createHash } from 'node:crypto';
import type { BillingState } from '../../../accounts/billing/billing.ts';
import { escapeHtml } from '../html-escape.ts';
import type { InvitationEntry, InvitationOverview, MemberOverview } from '../../../accounts/organizations/administration-overviews.ts';
import type { InvitationIdentityPolicy } from '../../../accounts/organizations/organization-directory.ts';
import { FORM_HEADERS, hiddenField, htmlDocument, NOTICE_HEADERS, postForm } from '../page-html.ts';
import { MEMBERS_STYLE } from './members-style.ts';

export interface MembersPageForm {
  readonly members: MemberOverview;
  readonly invitations: InvitationOverview;
  readonly subject: string;
  readonly csrfToken: string;
  readonly actions: { readonly send: string; readonly resend: string; readonly revoke: string };
  readonly navigation: { readonly product: string; readonly members: string; readonly organizations: string };
}

const ROLE_LABELS: ReadonlyMap<string, string> = new Map([['user', 'User'], ['admin', 'Admin']]);
const PLAN_LABELS: Readonly<Record<BillingState['plan'], string>> = { free: 'Free' };
const styleHash = createHash('sha256').update(MEMBERS_STYLE).digest('base64');
const memberHeaders = {
  ...FORM_HEADERS,
  'Content-Security-Policy': `${FORM_HEADERS['Content-Security-Policy']}; style-src 'sha256-${styleHash}'; img-src 'self'; font-src 'self'`,
};

// Both complete reads must succeed before this page is rendered. It shows current access and pending invitations.
export function membersPage(form: MembersPageForm): Response {
  const members = form.members.members.filter(({ status }) => status === 'active');
  const invitations = form.invitations.invitations.filter(({ state }) => state === 'pending');
  const memberRows = members.map((member) => `<li class="member-row"><p>${escapeHtml(member.email)}: active. Roles: ${rolesText(member.roles)}.</p>${member.subject === form.subject ? '<span class="you-label">You</span>' : ''}</li>`);
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Members · Thermus</title><link rel="icon" href="/assets/thermus-favicon.svg" type="image/svg+xml"><style>${MEMBERS_STYLE}</style></head>
<body><a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><div class="header-content"><a class="brand" href="${escapeHtml(form.navigation.product)}" aria-label="Thermus home"><img src="/assets/thermus-logo.svg" alt="thermus" width="166" height="40"></a>
<nav aria-label="Workspace"><a href="${escapeHtml(form.navigation.product)}">Product / Connect</a><a href="${escapeHtml(form.navigation.members)}" aria-current="page">Members</a><a href="${escapeHtml(form.navigation.organizations)}">Switch workspace</a></nav></div></header>
<main id="main-content" class="members-layout"><div class="introduction"><p class="eyebrow">Workspace administration</p><h1>Members</h1><p>${escapeHtml(form.members.organizationName)}</p></div>
<section class="invite-card" aria-labelledby="invite-heading"><h2 id="invite-heading">Invite to ${escapeHtml(form.members.organizationName)}</h2>
<p>User gives product and MCP access. Admin includes product and MCP access and can invite Users and Admins.</p>
${sendForm(form).join('\n')}
<p class="policy-note">${identityPolicyText(form.invitations.identityPolicy)}</p></section>
<div class="member-lists"><section class="members-card" aria-labelledby="active-heading"><h2 id="active-heading">Active members</h2>
<p class="list-note">Active product members: ${form.members.activeUserSeats}</p>
${members.length === 0 ? '<p>No active members.</p>' : `<ul class="member-list">${memberRows.join('\n')}</ul>`}</section>
<section class="members-card" aria-labelledby="pending-heading"><h2 id="pending-heading">Pending invitations</h2>
${invitations.length === 0 ? '<p class="list-note">No pending invitations.</p>' : `<ul class="invitation-list">${invitations.map((invitation) => invitationRow(form, invitation)).join('\n')}</ul>`}
</section></div></main><footer class="site-footer">Thermus AI Inc.</footer></body></html>`;
  return new Response(page, { status: 200, headers: memberHeaders });
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

// Billing has no write operation in the free plan.
export function billingPage(state: BillingState): Response {
  const page = htmlDocument('Billing', [
    `<p>Plan: ${PLAN_LABELS[state.plan]}</p>`,
    `<p>Billed seats: ${state.billedSeats}</p>`,
    '<p>This service collects no payment. The organization is on the free plan, and no seat is billed. Access depends only on the grants of each member.</p>',
  ]);
  return new Response(page, { status: 200, headers: NOTICE_HEADERS });
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
