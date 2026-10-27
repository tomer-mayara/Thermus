import { escapeHtml } from '../html-escape.ts';
import { htmlDocument, NOTICE_HEADERS } from '../page-html.ts';
import type { RemovalResult } from '../../../accounts/organizations/removal-operation-store.ts';

export { organizationSelectionPage } from './organization-selection-page.ts';

interface Notice {
  readonly status: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

// Each notice shows only this fixed text, so no request value reaches it and it needs no escaping.
const NOTICES = {
  signedOut: { status: 401, title: 'Sign-in required', paragraphs: ['Sign in to use this page.'] },
  denied: { status: 403, title: 'Access denied', paragraphs: ['Your account has no access to this page in the selected organization.'] },
  notFound: { status: 404, title: 'Page not found', paragraphs: ['This page does not exist.'] },
  noOrganization: {
    status: 200,
    title: 'No organization access',
    paragraphs: [
      'Your account has no active access to an organization.',
      'If an administrator of an organization invited you, accept the invitation in the email that you got. Then open this page again.',
      'If you have no invitation, contact the operator of this Thermus service. Only the operator can set up a new organization.',
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
  invitationAddressInUse: {
    status: 409,
    title: 'Invitation not sent',
    paragraphs: [
      'This email address already belongs to a member of the organization, or it has a pending invitation. Nothing changed.',
      'An existing member cannot be invited again. To replace a pending invitation, revoke it first.',
    ],
  },
  // The words of the owner of 27 October 2026. The Upgrade button comes with the paid tier, so the notice has no link.
  invitationLimitReached: {
    status: 409,
    title: 'Invitation not sent',
    paragraphs: ['This free workspace has 5 of 5 seats. Upgrade to Team to add more members.'],
  },
  changeUnsupported: {
    status: 503,
    title: 'Change not available',
    paragraphs: ['The account directory cannot make this change safely now. Nothing changed.'],
  },
} as const satisfies Readonly<Record<string, Notice>>;

export type NoticeName = keyof typeof NOTICES;

export function noticePage(name: NoticeName, headers: Readonly<Record<string, string>> = {}): Response {
  return noticeResponse(NOTICES[name], [], headers);
}

export function unconfirmedInvitationPage(membersPage: string): Response {
  return noticeResponse({
    status: 503,
    title: 'Invitation change not confirmed',
    paragraphs: [
      'The invitation change is not confirmed. It may have taken effect. Check the current status before making another change.',
      'A pending invitation does not confirm email delivery.',
    ],
  }, [`<p><a href="${escapeHtml(membersPage)}">Check status</a></p>`]);
}

const REMOVAL_NOTICES: Readonly<Record<RemovalResult, Notice>> = {
  applied: { status: 200, title: 'Member removed', paragraphs: ['The membership was removed. Open Members to read the current list, or choose another workspace.'] },
  denied: NOTICES.changeDenied,
  stale: NOTICES.changeStale,
  unsupported: NOTICES.changeUnsupported,
  'last-admin': { status: 409, title: 'Keep an Admin', paragraphs: ['Another Admin must join before this Admin can be removed. A pending invitation does not count. Nothing changed.'] },
  busy: { status: 409, title: 'Removal pending', paragraphs: ['A removal is still pending for this organization. No further removal was started. Contact Thermus support if it remains pending.', 'Members shows current access only. It does not confirm the pending operation.'] },
  unavailable: { status: 503, title: 'Removal unavailable', paragraphs: ['The membership could not be removed safely now. Nothing changed. Open Members to read the current list.'] },
  unknown: { status: 503, title: 'Removal not confirmed', paragraphs: ['The removal is not confirmed. It may have taken effect. Do not submit another removal. Contact Thermus support.', 'Members shows current access only. It does not confirm this operation.'] },
};

// Keep the write result separate from the next read, including after self-removal.
export function removalResultPage(result: RemovalResult, paths: { readonly members: string; readonly organizations: string; readonly invitations: string; readonly login: string }): Response {
  return noticeResponse(REMOVAL_NOTICES[result], [
    ...(result === 'last-admin' ? [`<p><a href="${escapeHtml(paths.invitations)}">Invite another Admin</a>. On Members, open Invite member, select Admin, and wait for acceptance.</p>`] : []),
    `<p><a href="${escapeHtml(paths.members)}">Read current Members</a></p>`,
    `<p><a href="${escapeHtml(paths.organizations)}">Choose a workspace or check access</a></p>`,
    `<p>If your session ended, <a href="${escapeHtml(paths.login)}">sign in again</a>.</p>`,
  ]);
}

export function noOrganizationPage(signupUrl?: string): Response {
  if (signupUrl === undefined) return noticePage('noOrganization');
  return noticeResponse({
    ...NOTICES.noOrganization,
    paragraphs: [
      NOTICES.noOrganization.paragraphs[0],
      NOTICES.noOrganization.paragraphs[1],
      'For help with access, contact the operator of this Thermus service.',
    ],
  }, [`<p><a href="${escapeHtml(signupUrl)}">Check free signup availability</a>.</p>`]);
}

// A user without access to a page often has no organization yet, so the page points to the onboarding guidance.
export function accessDeniedPage(organizationPage: string): Response {
  const link = `<a href="${escapeHtml(organizationPage)}">organization page</a>`;
  return noticeResponse(NOTICES.denied, [`<p>To select another organization, or to see how to get access, open the ${link}.</p>`]);
}

export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function noticeResponse(notice: Notice, extraContent: readonly string[], headers: Readonly<Record<string, string>> = {}): Response {
  const page = htmlDocument(notice.title, [...notice.paragraphs.map((paragraph) => `<p>${paragraph}</p>`), ...extraContent]);
  return new Response(page, { status: notice.status, headers: { ...NOTICE_HEADERS, ...headers } });
}
