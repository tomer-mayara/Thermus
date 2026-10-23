import type { BillingState } from '../../../accounts/billing/billing.ts';
import { escapeHtml } from '../html-escape.ts';
import type { InvitationEntry, InvitationOverview, MemberOverview } from '../../../accounts/organizations/administration-overviews.ts';
import type { InvitationIdentityPolicy } from '../../../accounts/organizations/organization-directory.ts';
import { FORM_HEADERS, hiddenField, htmlDocument, NOTICE_HEADERS, postForm } from '../page-html.ts';

export interface MembersPageForm {
  readonly overview: MemberOverview;
  readonly invitationsPage: string;
}

interface InvitationActions {
  readonly send: string;
  readonly resend: string;
  readonly revoke: string;
}

export interface InvitationsPageForm {
  readonly overview: InvitationOverview;
  readonly csrfToken: string;
  readonly actions: InvitationActions;
  readonly membersPage: string;
}

const ROLE_LABELS: ReadonlyMap<string, string> = new Map([['user', 'User'], ['admin', 'Admin'], ['super-admin', 'Super Admin']]);
const PLAN_LABELS: Readonly<Record<BillingState['plan'], string>> = { free: 'Free' };

// The page claims a strict address match only when the directory enforces it; any other policy gets the second text.
const STRICT_ADDRESS_TEXT = 'Only a sign-in with the invited email address can accept the invitation.';
const PROVIDER_RULES_TEXT = 'The sign-in service decides who can accept the invitation. It can accept a sign-in with another address, for example an address of the same domain.';

const ROLE_HELP = 'User gives access to the product and to MCP. Admin manages User invitations. Super Admin manages Admin invitations and billing. Each role is separate: Admin and Super Admin give no User access. Only the operator of this service manages Super Admin.';

// The provider gives the email addresses and roles, so the page escapes them. Member rows have no write controls.
export function membersPage(form: MembersPageForm): Response {
  const { overview } = form;
  const items = overview.members.flatMap((member) => [
    '<li>',
    `<p>${escapeHtml(member.email)}: ${escapeHtml(member.status)}. Roles: ${rolesText(member.roles)}.</p>`,
    '</li>',
  ]);
  const page = htmlDocument('Members', [
    `<p>Active User seats: ${overview.activeUserSeats}</p>`,
    '<p>Each active member with User counts as one seat, also with Admin or Super Admin. Members with only Admin or Super Admin, pending and inactive members, and invitations do not count. The count shows the current members; it is not a bill.</p>',
    `<p>${ROLE_HELP}</p>`,
    `<p><a href="${escapeHtml(form.invitationsPage)}">Invitations</a></p>`,
    '<ul>',
    ...items,
    '</ul>',
  ]);
  return new Response(page, { status: 200, headers: FORM_HEADERS });
}

// An invitation names one role. Each pending invitation of a role of the actor has a resend and a revoke form.
export function invitationsPage(form: InvitationsPageForm): Response {
  const { overview } = form;
  const sendForms = overview.invitableRoles.flatMap((role) => postForm(form.actions.send, [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', overview.organizationId),
    hiddenField('role', role),
    '<label>Email address <input type="email" name="email" required maxlength="254"></label>',
  ], `Invite as ${roleLabel(role)}`));
  const items = overview.invitations.flatMap((invitation) => [
    '<li>',
    `<p>${escapeHtml(invitation.email)}: ${escapeHtml(roleLabel(invitation.role))} invitation, ${escapeHtml(invitation.state)}.</p>`,
    ...invitation.changes.flatMap((change) => invitationForm(form, invitation, change)),
    '</li>',
  ]);
  const page = htmlDocument('Invitations', [
    `<p>${identityPolicyText(overview.identityPolicy)}</p>`,
    '<p>An invitation gives only the role that it names: an Admin invitation gives no User access. The sign-in service sends the email, and it activates the membership when the invited person accepts.</p>',
    // WorkOS gives the role of an invitation from the current role of its membership.
    '<p>The acceptance of a pending invitation gives the role that the page shows. For an accepted, revoked, or expired invitation, the sign-in service can show the current role of the member instead.</p>',
    `<p><a href="${escapeHtml(form.membersPage)}">Members</a></p>`,
    ...sendForms,
    overview.invitations.length === 0 ? '<p>There are no invitations.</p>' : '<ul>',
    ...items,
    ...(overview.invitations.length === 0 ? [] : ['</ul>']),
  ]);
  return new Response(page, { status: 200, headers: FORM_HEADERS });
}

// The free plan has no billing change, so the page has no form. It shows only a fixed label and a number, so it needs
// no escaping.
export function billingPage(state: BillingState): Response {
  const page = htmlDocument('Billing', [
    `<p>Plan: ${PLAN_LABELS[state.plan]}</p>`,
    `<p>Billed seats: ${state.billedSeats}</p>`,
    '<p>This service collects no payment. The organization is on the free plan, and no seat is billed. Access depends only on the grants of each member.</p>',
  ]);
  return new Response(page, { status: 200, headers: NOTICE_HEADERS });
}

function invitationForm(form: InvitationsPageForm, invitation: InvitationEntry, change: 'resend' | 'revoke'): string[] {
  return postForm(change === 'resend' ? form.actions.resend : form.actions.revoke, [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.overview.organizationId),
    hiddenField('invitation_id', invitation.invitationId),
  ], `${change === 'resend' ? 'Resend' : 'Revoke'} the invitation to ${invitation.email}`);
}

function roleLabel(role: string): string {
  return ROLE_LABELS.get(role) ?? role;
}

function identityPolicyText(policy: InvitationIdentityPolicy): string {
  return policy === 'invited-address' ? STRICT_ADDRESS_TEXT : PROVIDER_RULES_TEXT;
}

function rolesText(roles: readonly string[]): string {
  return roles.length === 0 ? 'none' : roles.map((role) => escapeHtml(roleLabel(role))).join(', ');
}
