import type {
  AuthorizedOrganization,
  InvitationEntry,
  InvitationIdentityPolicy,
  InvitationOverview,
  MemberChange,
  MemberEntry,
  MemberOverview,
} from '../organizations/organization-administration.ts';

interface Notice {
  readonly status: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export interface OrganizationSelectionForm {
  readonly action: string;
  readonly csrfToken: string;
  readonly returnTo: string;
  readonly organizations: readonly AuthorizedOrganization[];
}

export interface MembersPageForm {
  readonly overview: MemberOverview;
  readonly csrfToken: string;
  readonly grantAction: string;
  readonly invitationsPage: string;
}

export interface InvitationActions {
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

// Each notice shows only this fixed text, so no request value reaches it and it needs no escaping.
const NOTICES = {
  unavailable: {
    status: 503,
    title: 'Hosted authentication is not available',
    paragraphs: ['Hosted authentication is not available yet. No one can sign in, and no account, organization, billing, or MCP operation is available.'],
  },
  signedOut: { status: 401, title: 'Sign-in required', paragraphs: ['Sign in to use this page.'] },
  denied: { status: 403, title: 'Access denied', paragraphs: ['Your account has no access to this page in the selected organization.'] },
  notFound: { status: 404, title: 'Page not found', paragraphs: ['This page does not exist.'] },
  noOrganization: {
    status: 200,
    title: 'No organization access',
    paragraphs: [
      'Your account has no active access to an organization.',
      'If an administrator of an organization invited you, accept the invitation in the email that you got. Then open this page again.',
      'If you have no invitation, contact the operator of this Magumagu service. Only the operator can set up a new organization.',
    ],
  },
  invalidRequest: { status: 400, title: 'Request not valid', paragraphs: ['The request is not valid. Open the organization page again.'] },
  forgedRequest: {
    status: 403,
    title: 'Request refused',
    paragraphs: ['The form is not from this site or is no longer valid. Open the organization page again.'],
  },
  organizationDenied: { status: 403, title: 'Access denied', paragraphs: ['Your account has no access to this organization.'] },
  methodNotAllowed: { status: 405, title: 'Method not allowed', paragraphs: ['This page does not accept this request method.'] },
  formTooLarge: { status: 413, title: 'Form too large', paragraphs: ['The form data is too large.'] },
  formTypeRefused: { status: 415, title: 'Form not accepted', paragraphs: ['This page accepts only HTML form data.'] },
  requestFailed: { status: 500, title: 'Request failed', paragraphs: ['The request failed. Try again later.'] },
  mfaRequired: {
    status: 403,
    title: 'Multi-factor authentication required',
    paragraphs: ['Administration needs a sign-in that completed multi-factor authentication. Sign in again, complete the second step, and then open this page again.'],
  },
  changeDenied: {
    status: 403,
    title: 'Change refused',
    paragraphs: ['Your account cannot make this change in the selected organization. Nothing changed.'],
  },
  changeStale: {
    status: 409,
    title: 'Page out of date',
    paragraphs: ['The organization, the member, or the invitation changed after the page was shown. Nothing changed. Open the page again and check the current state.'],
  },
  invitationNotPending: {
    status: 409,
    title: 'Invitation not pending',
    paragraphs: ['The invitation is no longer pending: it was accepted, revoked, or expired. Nothing changed.'],
  },
  changeUnsupported: {
    status: 503,
    title: 'Change not available',
    paragraphs: ['The account directory cannot make this change safely now. Nothing changed.'],
  },
} as const satisfies Readonly<Record<string, Notice>>;

export type NoticeName = keyof typeof NOTICES;

const NOTICE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const ROLE_LABELS: ReadonlyMap<string, string> = new Map([['user', 'User'], ['admin', 'Admin'], ['super-admin', 'Super Admin']]);

// The page claims a strict address match only when the directory enforces it; any other policy gets the second text.
const STRICT_ADDRESS_TEXT = 'Only a sign-in with the invited email address can accept the invitation.';
const PROVIDER_RULES_TEXT = 'The sign-in service decides who can accept the invitation. It can accept a sign-in with another address, for example an address of the same domain.';

const ROLE_HELP = 'User gives access to the product and to MCP. Admin manages User access. Super Admin manages Admin access and billing. Each role is separate: Admin and Super Admin give no User access. Only the operator of this service manages Super Admin.';

// The selection forms post only to this site.
const FORM_HEADERS: Readonly<Record<string, string>> = {
  ...NOTICE_HEADERS,
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

const ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function noticePage(name: NoticeName, headers: Readonly<Record<string, string>> = {}): Response {
  return noticeResponse(NOTICES[name], [], headers);
}

// A user without access to a page often has no organization yet, so the page points to the onboarding guidance.
export function accessDeniedPage(organizationPage: string): Response {
  const link = `<a href="${escapeHtml(organizationPage)}">organization page</a>`;
  return noticeResponse(NOTICES.denied, [`<p>To select another organization, or to see how to get access, open the ${link}.</p>`]);
}

// The provider gives the organization names and IDs, so the page escapes them.
export function organizationSelectionPage(form: OrganizationSelectionForm): Response {
  const items = form.organizations.flatMap((organization) => [
    '<li>',
    ...postForm(form.action, [
      hiddenField('csrf_token', form.csrfToken),
      hiddenField('organization_id', organization.organizationId),
      hiddenField('return_to', form.returnTo),
    ], `${organization.organizationName}${organization.selected ? ' (selected)' : ''}`),
    '</li>',
  ]);
  const page = htmlDocument('Select an organization', ['<p>Select the organization to use in this browser.</p>', '<ul>', ...items, '</ul>']);
  return new Response(page, { status: 200, headers: FORM_HEADERS });
}

// The provider gives the email addresses, roles, and IDs, so the page escapes them. Each member has a form for each
// change that the actor can make now, with the revision of the membership that the page shows.
export function membersPage(form: MembersPageForm): Response {
  const { overview } = form;
  const items = overview.members.flatMap((member) => [
    '<li>',
    `<p>${escapeHtml(member.email)}: ${escapeHtml(member.status)}. Roles: ${rolesText(member.roles)}.</p>`,
    ...member.changes.flatMap((change) => grantForm(form, member, change)),
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
    `<p><a href="${escapeHtml(form.membersPage)}">Members</a></p>`,
    ...sendForms,
    overview.invitations.length === 0 ? '<p>There are no invitations.</p>' : '<ul>',
    ...items,
    ...(overview.invitations.length === 0 ? [] : ['</ul>']),
  ]);
  return new Response(page, { status: 200, headers: FORM_HEADERS });
}

export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function grantForm(form: MembersPageForm, member: MemberEntry, change: MemberChange): string[] {
  const label = change.action === 'grant' ? `Grant ${roleLabel(change.role)} to` : `Revoke ${roleLabel(change.role)} from`;
  return postForm(form.grantAction, [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.overview.organizationId),
    hiddenField('membership_id', member.membershipId),
    hiddenField('revision', member.revision),
    hiddenField('role', change.role),
    hiddenField('action', change.action),
  ], `${label} ${member.email}`);
}

function invitationForm(form: InvitationsPageForm, invitation: InvitationEntry, change: 'resend' | 'revoke'): string[] {
  return postForm(change === 'resend' ? form.actions.resend : form.actions.revoke, [
    hiddenField('csrf_token', form.csrfToken),
    hiddenField('organization_id', form.overview.organizationId),
    hiddenField('invitation_id', invitation.invitationId),
  ], `${change === 'resend' ? 'Resend' : 'Revoke'} the invitation to ${invitation.email}`);
}

// The button text is escaped here; the fields are complete HTML.
function postForm(action: string, fields: readonly string[], button: string): string[] {
  return [`<form method="post" action="${escapeHtml(action)}">`, ...fields, `<button type="submit">${escapeHtml(button)}</button>`, '</form>'];
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

function noticeResponse(notice: Notice, extraContent: readonly string[], headers: Readonly<Record<string, string>> = {}): Response {
  const page = htmlDocument(notice.title, [...notice.paragraphs.map((paragraph) => `<p>${paragraph}</p>`), ...extraContent]);
  return new Response(page, { status: notice.status, headers: { ...NOTICE_HEADERS, ...headers } });
}

function hiddenField(name: string, value: string): string {
  return `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}

function htmlDocument(title: string, content: readonly string[]): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '</head>',
    '<body>',
    '<main>',
    `<h1>${title}</h1>`,
    ...content,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPED[character] ?? character);
}
