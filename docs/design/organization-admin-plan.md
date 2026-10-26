# Organization administration plan

UI design selected: 26 October 2026 — Refined tabs. UI-01 is implemented in
[PR #263](https://github.com/tomer-mayara/Thermus/pull/263). UI-02 is implemented in
[PR #264](https://github.com/tomer-mayara/Thermus/pull/264), with UI-03
([PR #266](https://github.com/tomer-mayara/Thermus/pull/266)) now stacked on UI-02.
UI-04 remains the next child to restack.
See the [four UI tickets](#refined-tabs-ui--approved-design-26-october-2026).

Plan reviewed: 25 October 2026. Slice 1 and Slice 2 are merged, and the internal
Thermus AI rollout is live. [PR #252](https://github.com/tomer-mayara/Thermus/pull/252)
contains the first-event capture follow-up. Its revised contract below supersedes
the original rule that dropped the event which loaded or refreshed settings.
This correction has not yet been verified against the live customer destination.

The [Slice 2 review and remaining work](#slice-2-review-and-remaining-work)
retains the original stack review, redaction correction, and merge checks.
The [S2-04 ledger](../implementation/admin-s2-04.md#evidence-and-release-holds)
retains the rollout and release evidence. Ticket records describe their historical
increments; earlier missing features and candidate holds are not the current
internal rollout status. Historical gate passes do not verify this follow-up.

Slice 2.5 has provider, durable coordinator, Members UI, integrated SQL, staging
provider, and controlled recovery evidence in PRs
[#251](https://github.com/tomer-mayara/Thermus/pull/251),
[#253](https://github.com/tomer-mayara/Thermus/pull/253),
[#254](https://github.com/tomer-mayara/Thermus/pull/254), and
[#255](https://github.com/tomer-mayara/Thermus/pull/255). The 25 October
[stack review](../implementation/admin-s2-5-stack-review.md) found a P2 at its
reviewed head: the safety scan reads unused display email for every member and
can exhaust the operation budget.
[S2.5-R1](#s25-r1--read-safety-facts-without-display-hydration) implements the
source repair in PR #257. Its earlier checks, pending-review statements and
Draft actions are historical candidate records. On 26 October 2026, the user
directly reported architect approval of the entire original Slice 2.5 stack.
Current candidate pins, validation and approval reconciliation are in PR #257's
[Validation](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840671) and
[Quality review](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840871). The
[S2.5-02 ledger](../implementation/admin-s2-5-02.md) is the sole current Slice 2.5
release gate ledger. The [26 October production closeout](https://github.com/tomer-mayara/Thermus/blob/baff8d2a566ef39b97bd80aa8d88f6d19f839e74/review-evidence/s25-production-release-20261026/root/session-recovery-closeout/README.md)
records Slice 2.5 release and production fixture cleanup complete, with
`57c99e2b892acea52bfc3a53aee61b5ae442bf46` deployed. S2.5-02 is complete within
that recorded scope. This plan update performs no new live verification and
changes no unrelated first-event or Slice 3 MFA gate.

This document authorizes no access change, provider action, account change,
destination change, or cutover. Mock addresses are examples. Legal copy must use
the exact approved documents and agreement.

## Scope and release order

Build hosted organization administration with WorkOS in the existing Thermus
portal. Use email as the username and password authentication, with normal email
verification, password reset, sessions, and CSRF protection. User has product/MCP
access. Admin also manages the organization features shipped in that slice.
Current organizations/accounts are internal/test only; make a clean User/Admin
transition, without a legacy customer migration or customer Super Admin role.

| Slice | Scope at completion |
|---|---|
| 1 — Basic Admin portal | Narrow provider boundary, User/Admin roles, named organization and first Admin, creator agreement, active-member list, native invitations/acceptance, and workspace selection. Product + Members navigation; no member removal, role changes, MFA gate, flags, factors, or policy UI/state. |
| 2 — Collector export | Slice 1 plus Audit logs settings, safe content capture, and bounded best-effort export. No settings backup or restore service. Password only; no MFA dependency or member-reduction coordinator. |
| 2.5 — Member removal | Slice 2 plus Remove, including self-removal, with durable last-active-Admin protection. Password only; no role changes or MFA features. |
| 3 — Role changes and MFA | Change role reuses the Slice 2.5 coordinator and may ship independently of MFA. The separate MFA branch adds organization Security and personal factor controls after its free-entitlement/behavior gate passes. |
| 4 — Settings backup and recovery | Select and prove scoped encrypted settings backups, retention, custody, separate key recovery, and safe restore. No audit event archive is implied. |

Release in order **1 → 2 → 2.5 → 3 → 4**. Read-only feasibility work may run early.
On 24 October 2026, the owner moved backups to Slice 4 and chose to run Slice 2
without backups. Backup and restore proof are no longer Slice 2 release gates.
Use native forms/pages, existing assets, and app lifecycle. Add no modal framework,
React/widget dependency, identity mirror, or general provider framework. Leave the
working Better Auth local edition unchanged; keep later organization administration
possible at its existing account boundary. No username-alias registry, social
login, SSO, Directory Sync, WorkOS Audit Logs, or paid add-ons/dependencies are in
scope.

**Free-only rule.** All new infrastructure costs must remain **$0**. Verify free
entitlement and adequate capacity for the shipped slice; stop affected work and
ask the user if either is uncertain. No paid-only feature, expiring trial, new
charge, Supabase project/organization, transfer, or upgrade is approved. Do not
weaken guarantees to fit a free tier. Use the selected existing Supabase project below.
Schemas and fixed numeric/protocol bounds are engineering choices to validate
under this rule.

The free-only rule no longer applies to the tenant containers and the paid tier,
because the [self on-boarding plan](../implementation/self-onboarding-plan.md)
of 26 October 2026, in [PR #259](https://github.com/tomer-mayara/Thermus/pull/259),
supersedes it for them.

## Existing code, boundaries, and ownership

Planning baseline, before S1-01: signup was disabled by default and created a
personal workspace with User. Grants distinguished User, Admin, and Super Admin.
Account pages managed grants/invitations; administration required MFA, with proof
limited to Required-policy Password sign-in. The merged Slice 1 implementation
now retires those grant writes and inferred MFA checks, uses User/Admin, and adds
named creation plus the combined Members page. The ticket records give its
checks and remaining release holds. S2-01a implements the private audit destination
settings store and bounded SQL runtime. S2-01b in PR #238 implements the Admin
settings page and Save. S2-02a implements the isolated sender, and S2-02b adds
the saved-destination Test. The S2-03a candidate captures customer tool/Admin
events through a supplied sink. S2-03b adds fresh enabled/revision snapshots from
activity-driven settings reads. The 25 October follow-up keeps the first event
after startup or freshness expiry in bounded memory while those settings load.
An enabled result binds it to the observed revision; a disabled or failed result
discards it. This supersedes the original S2-03b warm-up drop rule. S2-03c connects
the revision-bound handoff to bounded memory admission and current-version dispatch.
[Tool completion records](../../src/interfaces/mcp/tool-completion-record.ts)
now omit tool URLs, queries, reasons, and results from operator output.

Start from [signup](../../src/accounts/providers/workos/workos-signup.ts),
[role mapping](../../src/accounts/providers/workos/hosted-role-mapping.ts),
[organization administration](../../src/accounts/organizations/organization-administration.ts),
[WorkOS directory](../../src/accounts/providers/workos/workos-organizations.ts), and
[account routes](../../src/interfaces/web/account/administration-routes.ts).
Keep permission checks, origin/CSRF protection, escaping, and non-cacheable responses.

| Owner | Responsibility |
|---|---|
| Accounts/organizations | Creation/agreement recovery, member invariants and durable reduction intents, later MFA flags/factor associations, and scoped support actions. |
| WorkOS adapter | Provider translation, callbacks/session sealing, and provider facts. WorkOS remains identity/membership truth and owns identities, organizations, memberships, roles, invitation delivery, and factor secrets. |
| Web/account | Native forms, browser sessions, selected organization, safe responses, and Slice 3 browser MFA proof. |
| Destination settings | Slice 2 tenant settings, revisions, and encrypted credential references. |
| System logs | Internal engineering diagnostics in `src/logs/system/`; no customer access. |
| Audit logs/app lifecycle | Customer audit events, destination settings, the shared private SQL adapter for removal intent in `src/logs/audit/`, and bounded OTLP delivery and shutdown. |

Reuse [identity/access](../../src/accounts/identity/access-context.ts),
[BrowserSession](../../src/accounts/identity/browser-session.ts), and
[OrganizationDirectory](../../src/accounts/organizations/organization-directory.ts).
When changing signup, move `SignupActivation`, document, and result contracts from
the WorkOS file into accounts. Shared web/profile contracts must expose no
`WorkOSBrowserSession`, `WorkOSSignedInSession`, SDK types, or sealed sessions.
Composition may name WorkOS and supplies allowed form destinations; the portal
must not hardcode a provider URL.

Extend contracts only as each slice needs them: trusted target subject for You/self-
removal, current supported-management status for safe refusal, and invitation
expiry for the pending list. The adapter owns these provider facts. Email is
enough for the member display; add no name-directory enrichment. Keep opaque,
authority-scoped IDs. Fix needed paths without a full authentication rewrite.
Future Better Auth can map its native organization/invitation policy here;
changing providers may still require identity/membership migration.

Slice 1 removes shipped `managedBy`/`billingState` MFA preconditions and retires the
current Required/Password proof inference and Optional masking in the
[session composition](../../src/app/hosted-workos-application.ts) and
[sign-in path](../../src/accounts/providers/workos/workos-sign-in.ts).
Discard inferred MFA evidence; never mark MFA complete without verification.
Slice 3 adds explicit verification; this cleanup adds no Slice 1 MFA policy
feature. Retire `/members/grants`, service
`changeGrant`, and other direct/unsafe writers; retain checked native invitations.
This adds no billing feature.

Provider references: [organizations](https://workos.com/docs/reference/organization),
[memberships](https://workos.com/docs/reference/authkit/organization-membership),
[invitations](https://workos.com/docs/authkit/invitations), and
[RBAC](https://workos.com/docs/rbac/integration).
[Widgets](https://workos.com/docs/widgets/user-management) bypass Thermus guards
through direct provider writes; use native controls.
[Admin Portal](https://workos.com/docs/admin-portal) configures enterprise services,
and [log streams](https://workos.com/docs/audit-logs/log-streams) do not export these
request events over OTLP. Neither is selected; no Vault dependency is needed.

Evidence recorded for this design on 22 October 2026: public
[pricing](https://workos.com/pricing) lists core AuthKit at $0 through 1 million
monthly active users, including email/password, RBAC, and native MFA.
[Organizations](https://workos.com/docs/authkit/users-organizations) are unlimited;
native invitation-email documentation lists no separate fee.
[Email/password](https://workos.com/docs/authkit/email-password) uses email as the
identifier; use standard domains/email. Production
[activation](https://workos.com/docs/authkit/environments) needs billing details,
without purchase approval. Standalone MFA entitlement remains a separate gate.

[Better Auth](https://better-auth.com/pricing) and its
[organization plugin](https://better-auth.com/docs/plugins/organization) are free
and open source, but local mail/UI remain app work. Preserve that boundary;
implement no local features here.

## Journeys and native UI

Follow [portal design](portal-design.md): existing assets, local IBM Plex fonts,
and approved palette. Members, Audit logs, and later Security are Admin navigation.
Account security adds MFA only in Slice 3. Browser workspace selection does not
change an existing MCP client's workspace.

Use labels, radio groups, status text, visible focus, and controls at least 48px
high. Ordinary forms and selection work without JavaScript. Use one column/cards
on narrow screens; wrap long values, preserve zoom/full labels, and announce
asynchronous results. Keep only non-secret input after safe errors when that flow
already supports restoration. Members invitation POST failures keep fixed notices
and discard input; native pre-submit validation keeps values. Never return
saved credentials/tokens in HTML, JSON, hydration, errors, logs, or events. The
transient MFA setup exception is defined below. Distinguish denied, stale, rate-
limited, failed, and unknown results; an outage is not an empty list.

### Create and join — Slice 1

After AuthKit sign-in, collect a name and the unchecked approved agreement. Keep
full documents readable, including the existing mobile reading controls.

```text
Thermus                                      Alex  [Sign out]
Create your organization
1 Sign in — complete     2 Set up your organization
Organization name [ Acme Labs                               ]
You will be an Admin: use product/MCP and invite members.
[Full approved Terms of Service and Privacy Notice]
[ ] [Exact approved organization agreement and authority wording]
[Create organization]
Free access. No card required and no automatic charge.
Already invited? Open your invitation email.
```

WorkOS owns invitation acceptance/sign-in. Reuse the Thermus callback and product
landing; add no duplicate join/acceptance UI.

```text
WorkOS/AuthKit — invitation, email/password sign-in, and acceptance
Organization: Acme Labs · Role: Admin · Invitation: alex@example.com
[Provider sign-in and acceptance screens]
Provider errors: Wrong account, expired invitation, revoked invitation.

Thermus — callback and landing
Trusted joined-organization context: Open the Acme Labs MCP guide.
Organization unclear with multiple memberships: [Choose workspace]
[Terms of Service]  [Privacy Notice]
```

### Members and invitations — Refined tabs

**Approved design direction — 26 October 2026. UI-01 is implemented in PR #263;
UI-02 and UI-03 have candidates in PR #264 and PR #266, with UI-03 stacked on UI-02.
UI-04 remains the next child to restack.**
The owner selected Refined tabs. The following wireframes replace the earlier
conceptual Members layout; they do not claim that the application has changed.
Follow [portal design](portal-design.md#members) and the
[UI implementation tickets](#refined-tabs-ui--approved-design-26-october-2026).
Keep current member/invitation behavior and release gates. Slice 3 role changes
and Security navigation remain separate work.

```text
Thermus       Connect | Members | Audit logs      Acme Labs [Switch workspace]
                        -------
Members · 3                                               [▸ Invite member]
Active product members: 3
┌ Member                         Role                   Action             ┐
│ alex@example.com  You          Admin                  [Leave…]           │
│ sam@example.com                Admin                  [Remove…]          │
│ jo@example.com                 User                   [Remove…]          │
└─────────────────────────────────────────────────────────────────────────┘
[▸ Pending invitations · 0]
[▸ Member removal help]
```

The links are real page navigation with `aria-current="page"`, not an ARIA tab
widget. Use the dark Thermus palette/local Plex fonts, a 32px serif title, sans
labels, and full-width aligned rows. The heading count is the number of displayed
active member rows from the complete read. Retain the smaller, separately labelled
`Active product members: N` caption from `activeUserSeats`. It counts product
access, so the numbers can differ: the existing Acme test fixture has seven active
rows and six product members. Do not change the seat rule or its billing tests.
Retain active memberships with no app role or an unknown role, their read-only
labels, and their existing `removable` decision. You uses the trusted subject.
Do not add role editing, a sidebar, search, bulk actions, a framework, or a provider
widget.

```text
Members · 3                                               [▾ Invite member]
Active product members: 3
Invite to Acme Labs
Email address [ name@example.com                                        ]
(*) User    ( ) Admin
User gives product and MCP access. Admin can also manage members.
[Visible recipient-policy note from the current identityPolicy contract]
[Send invitation] [Cancel]

Member rows (other rows omitted here):
jo@example.com             User                         [▾ Remove…]
  Remove jo@example.com from Acme Labs?
  This removes access here. The account and other workspace access remain.
  [Cancel] [Remove member — final red confirmation]

[▾ Pending invitations · 1]
nia@example.com             Admin    Expires 2026-11-02 18:00:00 UTC
                                    [Resend] [Revoke]
[▸ Member removal help]
```

Keep one document order at every width: heading/invitation task, member list,
pending invitations, then help. Opening Invite inserts its form before the list;
it does not reorder the other sections. Keep each mutation in its own form;
put no form inside another form.

Invite member is a native Details disclosure, closed on initial GET. Its open
trigger is neutral, with one orange Send invitation. Keep one email field,
`maxlength="254"`, the currently invitable User/Admin radios with User selected
when available, labels, role help, and the existing protected no-JavaScript POST.
Show no invitation trigger or form when no role is invitable. The summary closes
the form without a write; Cancel is a normal Members GET link that discards input.
Keep the policy note visible
inside the open form before submission. For `invited-address`, retain the exact
address promise. For `provider-rules`, retain the truthful generic sign-in-service
policy note; it can permit another address. The enum does not prove a complete
company/personal-email rule. Add no WorkOS-specific UI branch.

This plan deliberately refines the earlier design review: native pre-submit
validation retains values, but server failures keep the current fixed notice
pages and discard input. No inline server-error restoration, flash, session, or
query state is needed. On the last-Admin refusal page, place a clear instruction
beside the existing Invite another Admin link: on Members, open Invite member,
select Admin, and wait for acceptance. That link still lands on Members through
the existing invitation route, with the form closed. This flow needs no recovery
state on Members and does not depend on fragment-driven disclosure opening.

Pending invitations are a compact native disclosure. Count the complete filtered
pending collection; start zero closed and nonzero open. Keep absolute UTC expiry,
its machine-readable time, and only allowed Resend/Revoke forms. Keep these
actions quiet and specifically named. Revoke remains its existing protected POST;
this design adds no invitation-confirmation flow. Do not show
accepted history, invent relative times, or treat a failed/incomplete read as
zero. An invitation is not active access and a pending record does not prove
email delivery.

Keep quiet, visible Remove…/Leave… disclosures rather than a one-item menu, each
with a specific accessible member name. For removal/leave, use red only at final
confirmation.
Name person/workspace, preserve existing consequences and Cancel, and retain the
exact protected POST fields. The displayed overview strips permission grants:
role labels cannot prove last-Admin safety. Do not pre-disable Leave from a role
count or add provider/grants reads for this layout. Preserve the server's current
last-Admin refusal. Another active Admin must join; an invitation alone does not
count. The concept preview's disabled Leave action is illustrative only.

Keep confirmed, refused, busy, unavailable, and unconfirmed removal outcomes
separate. Preserve Read current Members and its warning that a current read does
not confirm an operation or make retry safe. Keep invitation Check status under
its existing rules. Add no optimistic row removal, unsafe Retry, or Undo. Existing
self-removal selection/sign-in recovery remains unchanged. Keep the approved full
Member removal help text, version and hash in a compact closed disclosure.

The existing later role-change flow remains Slice 3 work, outside these UI
tickets. Its earlier mock is retained here:

```text
Slice 3 — Change jo@example.com's role · Current role: User
( ) Admin — product/MCP, members, and Audit logs
(*) User — product/MCP
[Cancel]                                                   [Save role]
Last Admin: Another Admin must join before you change to User.
[Back to members] [Invite Admin]
Unknown result: We could not confirm the role change. [Check current status]
```

### Organization and personal security — Slice 3 MFA branch

```text
Thermus       Workspace [Acme Labs v]             Alex  [Sign out]
Connect your agent | Members | Security | Audit logs
                               --------
Security for Acme Labs
[ ] Require MFA for all Admins
[ ] Require MFA for all Users
Requirements are checked at portal sign-in after workspace selection.
Changes take effect at next sign-in.
Enrolled people keep MFA at future portal sign-ins if these are off.
Admin does not use the User requirement. MCP does not require MFA.
[Save]
```

```text
Account security — alex@example.com
Authenticator: On
MFA is required at future portal sign-ins while this is on.
MCP does not require MFA.
[Replace authenticator] [Remove authenticator]
If an active membership requires MFA:
Your organization requires MFA. You cannot remove your authenticator.
[Remove authenticator — unavailable]
If this session has not verified MFA:
Verify before removing it. [Verify MFA]
Replacement needs a verified current session and is allowed under a mandate.
Lost access to your authenticator? [Contact support]
When off: Authenticator: Off                     [Set up authenticator]
First setup: Scan [QR code] or enter [Manual setup key] in your authenticator.
Authenticator code [        ]                    [Verify setup]
Later required sign-in: Authenticator code [        ] [Verify]

Pending portal session: Complete the security check. [Continue securely]
[Choose workspace] [Sign out]
Lost access to your authenticator? [Contact support]
Recovery: Replace and verify your authenticator before continuing.
```

Explain blocked removal without naming other organizations. A failed requirement
read shows an error and refuses removal. Replacement reuses setup/verification.

### Audit logs UI — Slice 2

The [audit log rules](#audit-logs--slice-2) define customer access and event safety.
An Admin selects the organization, opens **Audit logs**, and chooses **Axiom** or
**Custom**. Both use a full HTTPS OTLP logs endpoint and a Bearer token. Axiom
requires a dataset; Custom has no dataset field. One Save applies these fields
and Enable export. Each load and Save checks
current Admin permission for that organization; a submitted organization ID is not
authority. S2-01b implements the page and Save, S2-02b implements optional Test,
and S2-03c implements bounded delivery. The mock shows the combined Slice 2 candidate.
The server must have the private settings connection and encryption key from
[owner setup](#owner-setup-for-supabase--slice-2). Admins enter their destination
credentials in this page; they do not receive the server's database credentials.

```text
Thermus       Workspace [Acme Labs v]             Alex  [Sign out]
Connect your agent | Members | Audit logs
                               -------
Audit logs destination
[ Send organization data only if you have authority to do so.    ]
[ Check destination access and retention. Read our Privacy Policy. ]
Destination: (*) Axiom  ( ) Custom
OTLP logs endpoint [ https://us-east-1.aws.edge.axiom.co/v1/logs   ]
Connection: HTTPS · OTLP/HTTP JSON
Axiom dataset [ audit-log-test                                 ]
Bearer token [ abcd****                                         ]
Saved token: Set · Leave blank to keep it for the same endpoint.
A changed endpoint requires a new token.
[ Off ] Enable export
[saved — clears after 30 seconds]
[Save]  [Test — optional]
Test saves these settings, then sends one synthetic event. Check receipt.
```

The warning links to the Privacy Policy. The page has no long export explanation
or authentication toggle. The privacy, capture, delivery, and backup rules below
still apply. The selector does not need a new database column: a saved dataset
identifies Axiom; its absence identifies Custom. Existing unauthenticated settings
remain readable, but any Save through this form, including disabling export,
requires a Bearer token.

### Narrow screens — Refined tabs

```text
Thermus
Acme Labs [Switch workspace]
Connect | Members | Audit logs
          -------
Members · 3
Active product members: 3
[▸ Invite member]
─────────────────────────────────
Member  alex.with.a.long.address@
        example.com  You
Role    Admin
Action  [Leave…]
─────────────────────────────────
Member  sam@example.com
Role    Admin
Action  [Remove…]
─────────────────────────────────
Member  jo@example.com
Role    User
Action  [Remove…]
─────────────────────────────────
[▾ Pending invitations · 1]
nia@example.com
Role    Admin
Expires 2026-11-02 18:00:00 UTC
[Resend] [Revoke]
[▸ Member removal help]
```

This is the same page and native disclosures at 320px. The invite form remains
on demand; opening it inserts its email, role, policy note, and Send invitation
in normal flow before the member list. Navigation wraps as visible page links;
no Menu, sidebar, drawer, modal, or scripted tab state is needed. Keep a sensible
keyboard order, visible focus, 48px targets, full labels, long-value wrapping,
and usable text zoom without horizontal scroll. Expanded help and confirmation
content must reflow too. Verify these facts in a real browser with JavaScript
both enabled and disabled; an HTTP/DOM test cannot establish CSS or validation.

## Canonical behavior rules

### Creation and joining — Slice 1

Record the creator's verified subject, organization, exact approved document
versions, authority confirmation, and time. Grant first Admin after agreement,
independently of factor enrollment. Invited members get readable Terms/Privacy
links, without their own acceptance screen/record, per-request agreement lookup,
or legal workflow. The revised creator/authority/organization and invited-use
legal bundle needs approval before rollout.

Creation stays in signup. People with current product access have no extra Create
organization action or hidden route. Past invited membership alone does not bar
creation after access is lost. A prior creator's retained record instead follows
existing saved-start/support recovery; removal does not promise every former
creator a new organization. Keep multiple invited memberships and the selector.

Reuse deterministic external IDs, provider metadata, verified identity, and
existing recovery. Reconcile uncertain creation/restart without duplicate
organizations or replay of a first-Admin grant that may have been revoked.
Ordinary WorkOS writes have no assumed `Idempotency-Key` deduplication; see the
[SDK limitation](https://workos.com/docs/sdks/rust). A successfully usable Thermus
organization has a verified first Admin and must retain an active Admin. Failed
creation can leave an inaccessible organization for support recovery; never
repair it by blindly replaying grants. This uses existing recovery facts, not a
new active-organization flag/table or activation registry.

Successful creation selects its organization and opens the MCP guide. Joining
uses trusted callback/validated provider context plus current membership. If the
joined organization is unclear, reuse selection; multiple memberships use the
existing selector. Never guess or change existing MCP bindings.

### Native invitations — Slice 1

Existing organizations are invitation-only. Public signup without an invitation
creates an organization under the creation rules. No discovery, request/approval,
or domain/JIT auto-join. Native invitations carry User/Admin. Corporate invite
links may be accepted by another address in that domain, including Admin invites;
consumer invitations require the exact address. Domain matching alone grants
nothing. Add no custom exact corporate-email check or member activation flow.
Acceptance creates active access regardless of enrollment. Already joined means
current active membership. An invitation must never change an existing active
member's role; explicit role changes arrive in Slice 3.

Reconcile unknown send/resend/revoke outcomes before another write. Do not guess
an invitation ID, blindly resend, or claim revocation after acceptance. Rejection
must not disturb access to another organization. Keep invitation/provider tokens
out of application pages, logs, and exports; store no invitation tokens or
activation registry. No-access pages list no other person's invitations.

The [pinned WorkOS OpenAPI contract](https://github.com/workos/openapi-spec/blob/1cfae382eda055174703010c77b4d58f6ed59603/spec/open-api-spec.yaml)
defines these ordinary lifecycle rules:

| Operation | Contract |
|---|---|
| Send | Rejects `user_already_organization_member` and `email_already_invited_to_organization`. |
| Accept | Rejects `invite_not_pending`, `invalid_invite`, and `invite_has_accepted_user_id`. |
| Resend | Pending-only; terminal errors are `invite_expired`, `invite_revoked`, and `invite_accepted`. |
| Revoke | Rejects `invite_not_pending`. |
| Invitation `role_slug` | Reflects the invitee's current membership role, not immutable role history. |

Before release, prove active-role preservation for a same-domain alternate
recipient who is already active, in both User/Admin opposite-role directions;
two different-address outstanding invitations in the same organization accepted
by one identity in either order; and acceptance/resend/revoke races. The contract
does not settle these cases; emulator behavior is not production proof. Local
locks/retired grant routes cannot guard hosted acceptance. Hold if acceptance can
change an active role or preservation remains unproven. Pending-invitation revoke
is not membership removal and needs no last-Admin coordinator.

### Authorization and member writes

All slices check the current actor, organization, permission, authenticated password
session, CSRF/origin, and stale forms. Slices 1/2 ship only read/list and checked
native invitation paths. Slice 2.5 adds removal; Slice 3 adds checked role changes.
None revives retired grant writers. Slices 1/2/2.5 have no application MFA gate or
policy state. Slice 3 role changes can ship under password authentication; the
separate MFA branch applies its session decision only to portal paths.

Before removal/role effects, recheck actor, organization, target membership,
current role, supported-management status, and form revision. Refuse stale,
inactive, unknown/unsupported, or directory-managed targets. Unsupported states
need operator review.

**Removal — Slice 2.5.** Delete only an ordinary User/Admin membership, never the
global user. Rejoin by fresh invitation. Preserve other memberships and the shared
personal factor; provider deletion need not preserve every other session.
Self-removal may need reauthentication; send the person to selection or the
no-membership page with invitation guidance and signup when eligible. Count
current active product access once per User/Admin membership; exclude pending or
inactive memberships/invitations. Billing remains the existing free scope.

**Role changes — Slice 3.** Write one intended final role, User or Admin, without
reinvitation, agreement, or target-MFA activation. Permissions change immediately;
self-demotion loses Admin access and returns to product. New MFA requirements
follow the next-sign-in rule below. Role changes do not depend on MFA API cost.

**Last Admin — Slice 2.5, extended in Slice 3.** Always retain at least one active
Admin in a usable organization, including self-removal and retries; Slice 3 adds
demotion. Pending/inactive members/invitations do not count; an active Admin counts
without factor enrollment/proof. Allow one membership reduction at a time per org,
recheck actor/target/count, and save intent before WorkOS. Slice 3 extends the same
durable mechanism so concurrent removal/demotion cannot remove the last Admin.

A timeout, crash, expired lease, or unchanged read cannot prove a late WorkOS write
will not complete. Block conflicting Admin reductions until positive completion/
reconciliation or operator evidence that the request settled. Keep unknown writes
across restart. Never blindly replay them or restore access changed afterward.
Restrict independent operator/IdP writes through the runbook; app coordination
cannot make them globally atomic. Slices 1/2 have no reductions and need no such
coordinator; native invitation role-preservation proof still applies.

### Portal MFA — Slice 3 MFA branch

**Sign-in decision.** Store two organization booleans, Require MFA for Admins/Users,
both false for new/internal-test organizations. Require MFA if an active portal
factor exists OR the initially selected organization's flag requires it for the
current role. Admin uses only the Admin flag. Finish initial workspace selection
first; do not combine all memberships' requirements. Unenrolled people without an
applicable flag need no setup/challenge, including on Admin pages. If a successful
current-membership read proves there are no eligible organizations, decide using
only the active-factor or pending-recovery requirement, then complete admission
before showing no-membership/signup. Failed reads are errors, never zero
organizations. A new organization defaults to optional MFA. Later creation,
joining, or selection in an admitted session keeps that session's decision until
next sign-in; guess no organization and add no registry. Either role can
enroll voluntarily. Active enrollment requires future portal challenges even
after a mandate is turned off; store no separate preference/reason state.

An explicit false/default differs from a failed policy read; errors cannot become
both off. Flags are organization-scoped, never environment-wide Required MFA.
Only a current Admin saves them, using the session's admission decision plus
CSRF/stale checks. No extra per-action challenge or unconditional Admin-MFA gate.
Use the same rules in tests without a debug bypass.

**Session.** When required, get fresh proof before protected portal access. Record
completed admission even when MFA is optional; absent proof alone must not mean
pending sign-in. One check lasts through that authenticated browser session,
including refresh and workspace switching. Closing a browser may preserve it.
No timed rechecks/remember-device option, and no proof carried to a new sign-in.
Flag, role, or workspace changes add no mid-session challenge/logout. For example,
an unenrolled person admitted to optional Org A can switch to already-required
Org B until the next sign-in. Current membership/role/permission checks remain
immediate on every request. Sign-in, setup, verification, logout, and selection
recovery stay reachable while pending. Enrollment never activates membership or
changes the last-Admin count.

**Own-factor removal.** Either role can remove its own factor only from an
MFA-verified current session. An unverified older session must verify first;
existing proof needs no extra timed/per-action challenge. At submission, freshly
read all active memberships, their roles, and applicable flags. Allow removal only
if none requires MFA; unknown membership or failed reads deny it. Pending/inactive
memberships do not count. This all-membership check is removal-only, not sign-in
policy. Keep CSRF/stale checks. Removal ends the enrollment requirement at future
sign-ins; current sessions continue and organization mandates still apply then.

**Own-factor replacement.** Either role can replace from a verified current
session, including under a mandate. Verify the new factor, atomically switch from
the expected current association, then retire the old factor. MFA stays enabled.
Failure/abandonment preserves the old active factor; stale parallel work cannot
overwrite the winner. After a committed switch, old-factor deletion failure cannot
restore old trust; record cleanup for bounded retry/operator resolution. Without
a verified session, use support recovery. Reuse setup/verification, with no new
activation framework or removal's no-mandate check.

**Support recovery.** For an unusable authenticator with no verified session,
Thermus support verifies identity, records a scoped action, and helps replace it,
including for a locked-out last Admin. Fresh setup/verification precedes admission.
Keep the enrollment requirement while replacement is pending, even if the old
factor is cleared and the selected organization is optional. Only the scoped
support-authorized replacement path admits that subject after fresh verification;
clearing the old factor is not self-service disabling or a mandate exemption.
Unrelated portal sessions keep their agreed lifetime. Organization Admins cannot
reset another person's account-wide factor. No recovery codes, new support role,
generic reset-token/workflow system, or new session-revocation policy. Define and
validate identity checks/provider steps in a small operator procedure; do not
assume email alone proves identity or claim a verified production reset recipe.

**Mechanism and proof.** The [standalone factor API](https://workos.com/docs/reference/mfa/factor)
supports enrollment without `user_id`; the existing
[v11 SDK](https://github.com/workos/workos-node/blob/v11.0.0/src/multi-factor-auth/multi-factor-auth.ts)
already provides create/challenge/verify/delete. Omit `user_id`; issuer/user are
display labels, not identity binding. Use a small authority + authenticated-subject
→ pending/active association; WorkOS keeps secrets. This request shape is resolved;
keep WorkOS MFA pending explicit free production-use confirmation. Actual
AuthKit/MCP isolation also needs proof below. Do not select app-managed TOTP or
store seeds in Thermus.
[User-linked AuthKit factors](https://workos.com/docs/reference/authkit/authentication)
require TOTP at sign-in and risk the shared MCP flow. [AuthKit MFA](https://workos.com/docs/authkit/mfa)
and [organization policies](https://workos.com/docs/authkit/organization-policies)
do not establish these per-role controls. [Freshness](https://workos.com/docs/authkit/reauthentication),
enrollment, and [authentication responses](https://workos.com/docs/reference/authkit/authentication)
do not prove completed MFA. Introduce explicit verification after the Slice 1
inference cleanup. Thermus must bind the expected
challenge/factor to the authenticated subject and actual browser WorkOS session;
the [verification response](https://workos.com/docs/reference/mfa/challenge) does
not supply that application binding.

Verify pending enrollment before atomic promotion. Only verified self-service or
support replacement can switch an active association. At challenge completion,
recheck the current active association: an old-factor challenge cannot gain fresh
proof after replacement/removal. Already trusted sessions retain their lifetime.
Thermus stores factor IDs/associations and session proof, never TOTP secrets/setup
keys. Show QR/manual setup key only in the transient no-cache response. Protect
codes/secrets and attempts. Set a per-attempt TOTP deadline; the
[documented ten-minute expiry](https://workos.com/docs/mfa) is for SMS. Prove same-code rejection across separate parallel
challenges: a single-use challenge alone does not prove it. Clear proof at session
end/new sign-in; prove abandoned/parallel setup and replacement behavior.

The [existing validation](../implementation/auth-workos-mcp-url-fetch-validation.md)
shows Google enrollment progress, not this full password flow. Prove new portal
factors stay absent from AuthKit's user-factor list and that retained identities'
old factors/policies cannot challenge MCP sign-in, consent, reconnect, or refresh.
Google/SSO are not release gates. Authorized account deletion/recovery cleans
obsolete factor/setup material without making membership removal account-wide
cleanup or revoking unrelated session proof.

### MCP authorization — all slices

MCP never requires MFA, including through recovery. Browser proof must not gate
connection, sign-in, consent, reconnect, or refresh. Add no MFA approval/claims/
binding, consent registry, or reset-related MCP sign-out. Keep valid-token,
organization, current active membership/role, and permission checks. Gate web
paths, not the shared `AccessResolver`; the browser MCP guide follows portal rules.

### Audit logs — Slice 2

System logs are the current Thermus engineering diagnostics. Only Thermus
operators use them; customers have no access. `src/logs/system/` owns
`SystemLogger` and its ConsoleSystemLogSink/OtelSystemLogSink output roles.
SystemLogger prepares severity, time, failure text, and automatic source file
and line enrichment before its synchronous sink call. Existing account change records in this output
remain internal. S2-03a adds separate customer audit capture through a supplied sink.

Audit logs are the customer organization Admin feature. `src/logs/audit/` owns
the destination store/runtime and the concrete event-specific `AuditLog` class.
`AuditEventSink` separates this projection from destination delivery. S2-03a
extends `toolCompleted` with validated input and final public result copies. The
event owner redacts recognized credentials and bounds serialized UTF-8 bytes.
Invitation and Audit logs actions use event-specific metadata methods. Capture
uses independently trusted boundary context. S2-03b gates hosted capture on
fresh enabled/revision metadata. S2-03c supplies bounded asynchronous dispatch
with a fresh full-version authorization read before each attempt.
Add administration event methods only as the actions ship. Audit events have no generic `info`/`error` API and no automatic source or stack metadata. Never
repurpose a system logger or its OTel adapter, or share their output stream with
audit delivery. Shared classes under `src/logs/` are appropriate only for real
common behavior; these roles require no shared base class.

Slice 2's first production audit sink sends OpenTelemetry OTLP/HTTP JSON to the
organization's configured Collector or supported OTLP service. Direct Axiom
export uses its required dataset name as the `x-axiom-dataset` routing header,
with the full HTTPS logs URL and Bearer token. The owner authorized this addition
on 24 October 2026 after confirming that no Collector exists. This does not
promise support for every provider or establish actual ingest compatibility.
The existing `AuditEventSink.writeAuditEvent`
contract separates event capture/projection from delivery. S2-03c implements this
sink with bounded memory admission and dispatch through the S2-02a sender;
the synchronous call does not wait for export. `DestinationSettingsStore` is a
separate settings port, not an event sink. The Slice 2 PostgreSQL settings store
holds only destination configuration, never audit history or an event buffer.
A future SQL or other sink adapter can use the same event contract without
changing capture. Add no such adapter, fan-out,
sink plugin framework, or generic settings backend in Slice 2.

Slice 2 promises no in-app log viewer. S2-01b implements the Audit logs settings
UI and Save in PR #238. S2-02b adds the optional saved-destination Test
with one synthetic event. S2-03a adds MCP/admin capture, redaction, and truncation
through a supplied sink. S2-03b adds hosted activity-driven settings snapshots;
S2-03c adds customer completion dispatch; its queue can drop work, and receipt
or durable Collector storage is not guaranteed.
The technical database, role, SQL table, and environment names remain compatible,
including `DATABASE_URL` and `LOGGING_DESTINATION_ENCRYPTION_KEY`.

**Why SQL remains.** Destination configuration must survive restart and be shared
across application instances. The Admin page in S2-01b calls
`DestinationSettingsService`, which uses `DestinationSettingsStore` for reads and
atomic revision saves. `PgDestinationSettingsStore` implements those operations;
`BoundedSqlRuntime` owns the pool, deadlines, admission, and cleanup. These are
required settings dependencies, not dead event-storage classes. The S2-01a
foundation opens and closes them before S2-01b adds browser reads/writes. Keep
them; there is no SQL audit-event writer or event table to delete. Export uses
the separate `AuditEventSink` boundary and reads settings without writing events
to that store.

Current Admin permission and password authentication authorize settings/Test.
The later MFA branch adds its portal session gate without changing this export
contract or MCP authorization.

**Content and routing.** Enabled export includes validated MCP inputs and final
public results/errors: search queries, requested URLs, fetched text, and reasons,
plus administration metadata. No content checkbox or metadata-only mode. Exclude
internal HTTP traffic, sign-in forms, cookies, Authorization headers, and logging
tokens. Redact known credential fields/recognized credential-bearing URL params;
arbitrary free text cannot be promised secret-free. Redaction must preserve
surrounding public content when its boundary is known, including JSON sibling
fields and enclosing Markdown. Do not treat over-redaction of an admitted event
as allowed best-effort delivery loss. Keep ambiguous credential text redacted;
do not fix content loss by exposing part of a credential.

Capture one structured customer completion event at the
[MCP boundary](../../src/interfaces/mcp/fetch-tool-server.ts): validated
`{url, reason}`/`{query, reason}`, trusted org/actor/operation context, and final
public projected text after safe failure/cancellation mapping. Exclude invalid
argument objects, unknown tools, `_meta`, raw exceptions, and intermediate HTML.
Record the result produced, not client receipt; preserve withheld/empty semantics.

Use a separate customer sink. Also remove tool URL/query/reason/result from
operator completion output; retain stable operation/tool/status/duration and
opaque identity metadata. Prove distinctive tool content goes only to the enabled
customer sink, not operator/Render diagnostics or export-error feedback. This is
a focused completion-record change, not a system-logger rewrite.

Administration events cover Thermus-handled member, role, invitation, organization
MFA-policy, and audit destination actions as each ships. Use independently trusted tenant/
actor context; a request-supplied organization ID is not routing authority. A denied
request from Org A naming Org B must not send metadata to B's Collector without
independently established B context. Unattributable attempts stay in sanitized
operator diagnostics. Export no global personal-factor/support actions into
tenants; support's scoped operator record stays separate. WorkOS authentication
logs remain in WorkOS, without promised direct provider/IdP coverage. Proposed
fields are timestamp, event name, opaque actor/org IDs, optional actor name,
operation, status, duration.

Customer events keep `actor.authority` and `actor.subject` as the authoritative
identity. Optional `actor.name` is an event-time account-profile snapshot for
readability, not authorization or routing. It applies to MCP completions, portal
administration, destination action metadata, and the synthetic Test event. Use
the provider-neutral resolved `user.name`; never use an email fallback or a name
from tool arguments or form fields. Blank names, control characters, ill-formed
Unicode, or names over 1,024 UTF-8 bytes omit the name and retain the ID-only
event. System records keep their existing opaque identity fields.

WorkOS resolves authority, organization, and current grants before it attempts
one profile read for an allowed resolution. The profile ID must match the
authenticated subject. Prefer a nonempty native profile name. A missing, null,
or blank native name permits joined trimmed first and last names. An invalid
nonempty native name is omitted, even if the split fields are valid. The read
uses the existing SDK with no retries and a
five-second deadline that aborts the request and response-body read. Failure or
missing profile data omits the name without denying the authorized operation.
This read also occurs when audit export is disabled; denied resolutions make no
profile read. No token-template change, profile cache, or new datastore is added.
Better Auth uses the name from its existing account read; local export stays
disabled. These source changes do not establish deployment.

**Capture bounds and result safety.** Measure event/queue budgets in serialized
UTF-8 bytes and original/captured result sizes in UTF-8 bytes. Budget maximum valid
inputs and metadata, including JSON escaping, before allocating result space.
Use maximum valid inputs under the current
[fetch](../../src/interfaces/mcp/fetch-tool-schema.ts) and
[search](../../src/interfaces/mcp/search-tool-schema.ts) input contracts; add no
product input-size change. Truncate only the exported result copy
at Unicode boundaries, within the fixed result/event budgets, with original size
and an explicit marker. Client results stay complete. Bound queue counts too.
Choose fixed v1 schemas/limits and test maximum inputs, escaping, and byte/Unicode
boundaries, not just examples. No per-org numeric setting, chunks/reassembly, or
general text serializer.

At event creation, use an available fresh per-org settings snapshot. A fresh
enabled snapshot binds the event to its saved revision; a fresh disabled snapshot
drops it. If the snapshot is missing or expired, keep the detached, frozen event
only while one bounded asynchronous settings load runs. This includes the first
event after startup and the event that starts a freshness refresh. Other events
for that org may join the same pending batch within its fixed limits. Never await
this load in a tool/admin response.

A successful, current, unexpired enabled read binds the pending events once to
that observed revision. Notify the collector of the observation, then admit the
batch in arrival order. A disabled, absent, invalid, failed, or late result drops
the batch permanently. Close also clears it. Fresh disabled snapshots, failure
backoff, and exhausted capacity refuse new content. A later Enable or recovery
cannot revive discarded events. The initial read is the admission decision; it
does not prove enabled state at the event timestamp. An Enable that overlaps the
pending read can be observed and authorize that batch. Each send still requires
the collector's separate fresh enabled/exact-revision check.

Keep only enabled/revision metadata in resident snapshots, never endpoints or
credentials. Each load may hold at most 16 events and 1 MiB of serialized UTF-8
event bytes, with at most 131,072 bytes per event. Two load reservations bound
pending capture to 32 events and 2 MiB, separate from the collector queue. The
2.5-second load deadline starts with the first event and later events cannot
extend it. Drop pending payloads at timeout or close, but charge an unresolved
physical read until its promise settles. These limits bound content and records,
not JavaScript heap.

Bound resident snapshot/backoff items and bytes; evict through activity, treating
evicted orgs as unknown. Late loads cannot restore evicted or shutdown state.
Idle tenants cause no reads. A failed refresh leaves capture unknown with only
bounded backoff bookkeeping until later eligible activity starts a new load.
Add no general cache framework, idle polling, durable event store, or replay.

Customer sink failure cannot change tool results or fail/replay completed admin
actions. Isolate it from throwing post-write `ChangeRecorder.record()` calls made
by `ChangeRecording.keep()` and from tool execution; capture/enqueue remains bounded.
Exclude sender responses, retries, and settings-read diagnostics from customer
capture. The Test button records the Save and Test phases separately; the labelled
synthetic Test record is separate from both. Export work must not capture itself.

**Settings and Test.** The destination panel fills the shared page content width,
up to 1,200 pixels. Keep Save and gray secondary Test beside each other at their
natural widths, with a gap. Wrap the action row when it cannot fit. Keep the
Members layout unchanged. Show Enable export as an On/Off switch with a stable
label. It keeps the native checkbox value and works with a pointer or keyboard,
also without scripts. Save or Test saves the switch as shown. Choose
Axiom or Custom. Use one public HTTPS OTLP logs endpoint and one write-only
Bearer token field. Show the saved token's first four characters followed by
`****` as a placeholder; the input value stays empty. Mask tokens of four or
fewer characters completely. Typing a token replaces it; blank input keeps it.
Derive this hint from the valid saved credential without storing another copy.
Axiom requires its dataset;
Custom omits it. A dataset uses 1–128 ASCII letters,
digits, or hyphens and supplies only `x-axiom-dataset`; no arbitrary header editor
is added. Direct Axiom uses the full logs URL and Bearer token, not the web stream
page URL. No private-network destination, custom auth headers, or client
certificate. One validated Save atomically applies endpoint, dataset, auth, and Enable; failed validation applies nothing. New settings start
disabled until explicitly enabled. Every actual change, including toggles, updates
one revision; unchanged Save, including re-entering the same token, does not.
The destination owner decides semantic equality and preserves ciphertext on a
no-op; the store atomically checks revision and writes. No draft/active copies.
Blank Bearer input retains it only for unchanged endpoint/auth; a changed
endpoint needs a replacement. The service keeps its existing None support for
stored settings and sender compatibility; the Admin form offers only Bearer.
Encrypt secrets server-side with a key
outside the store; never return a complete credential. Only the narrow saved
preview above may reach the Admin form. Keep it out of Test inputs, Audit events,
and sender destinations. All writes reject stale forms/revisions. A Save
timeout can leave its commit unconfirmed; show that outcome and reload current
settings/revision before another write. A timed-out Save may commit after that
read; subsequent writes still require atomic expected-revision checks. Never
automatically replay the Save.

Optional Test first saves the current form, including the export switch. Only a
confirmed saved or unchanged result permits the Test. A failed, stale, or uncertain
Save sends no Test event. Use the returned saved version and an empty token field
for the existing saved-destination Test operation. It works disabled and sends
one labelled synthetic event. Freshly check that saved version before send and
read its revision again after settlement, before producing the response.
A mismatch or failed post-read suppresses the result; no browser polling is needed.
Keep no history/dashboard/version controls. Show the result inside the normal
Audit settings layout. State that settings were saved when the send fails; a
failed Test does not roll back Save. An uncertain Save keeps a styled recovery
notice with only a GET saved-state link and no write form. No automatic retry.
Save and Test return the confirmed form directly to the POST. Show `saved` above
the buttons only for the confirmed saved version shown in the form, for 30 seconds
or until the form changes.
Reserve its height so clearing it does not move the buttons. The small page
script preserves scroll across submission using one expiring, consumed record
of position and time in tab storage. It stores no credentials or form content,
and storage failure must not block submission. Recovery pages handle the same
record safely. Without scripts, the native form and honest result still work;
timed hiding and scroll restoration need scripts. A deliberate browser
resubmission may send another Test event. Test proves neither continued delivery nor durable
storage and is never a prerequisite to enable.

**Egress and revisions.** At actual connection, enforce public HTTPS/IP, allow
Collector paths, reject userinfo/fragments/all queries, and follow zero redirects.
Prevent private/loopback/metadata-service access and credential forwarding. Isolate
customer TLS/headers from system OTel defaults; the pinned SDK can merge headers.
Other protocols/query-auth are deferred.

Async dispatch/retries read enabled/current revision across instances only when
work exists. One fresh read of a full saved settings version supplies revision,
enabled state, endpoint, and credential immediately before each attempt; recover
the credential through the destination owner. The same read authorizes the attempt,
with no second pre-send read or mixed versions. A later concurrent Save can race it. Drop old-revision work when a change,
including disable→enable, is observed; never retarget it. Stop new dispatch then.
Started attempts may finish; cancel when possible, but sent data cannot be recalled.
Hold no SQL lock across network work; add no idle polling or keepalives.
Settings-read failure stops export without blocking product. Synthetic tests share the bounds and submitted saved
revision, with the explicit disabled-state exception.

**Delivery and protocol.** Use a bounded in-memory queue, no durable queue/replay
service/export worker. Slow/unavailable Collectors never delay tools or completed
admin actions. Overload/restart can lose logs; retries may duplicate them. Bound
global/tenant items/bytes, active destinations, concurrent sends, payload/response
sizes, retries/time, and use the existing shutdown deadline. Item/byte accounting
covers queued, settings-read-waiting, in-flight, and retry-backoff content. One age
deadline starts at admission and includes failed reads, attempts, and backoff;
never reset it. Release accounting once, after disposal. Bound connection/agent
resources; add no per-tenant exporter pools.

Follow [OTLP](https://opentelemetry.io/docs/specs/otlp/) and validate actual
OTLP/HTTP JSON with None/Bearer: POST with `Content-Type: application/json`,
lowerCamelCase fields, and decimal-string 64-bit timestamps. Acceptance requires
both `timeUnixNano` and `observedTimeUnixNano` to use the captured event timestamp.
Thermus creates these Audit events when it observes the completed tool or admin
action, or creates the synthetic Test event. Convert that timestamp once; preserve
it through queue delay and retries. Do not use send time. This follows the
[OpenTelemetry application-event timestamp model](https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-observedtimestamp)
and prevents receivers from displaying an omitted observed timestamp as 1970.
Protocol acceptance requires
HTTP 200, matching JSON content type, and a valid OTLP JSON response; `{}` is valid
under those conditions. Parse full acceptance, zero-rejection warning, and partial
rejection. A malformed HTTP 200 success body cannot confirm acceptance: return a
typed non-success/unconfirmed outcome, without claiming rejection, and do not retry.
Oversized responses are also nonretryable. Never retry warnings or partial rejection.
Retry HTTP 429/502/503/504 only, never other 4xx/5xx; a bounded malformed or HTML
error body does not override that status classification. The sender parses bounded
`Retry-After` seconds or dates; the queue owns delay, jitter, and attempts. Honor
the delay; drop work if it exceeds item lifetime rather than shorten it. Transport
failures may be transient or unconfirmed under the bounded retry policy. The pinned
exporter's callback cannot establish partial acceptance; a narrow OTLP/HTTP JSON
sender is allowed. Sanitize diagnostics and promise no universal receiver or
provider support. The 24 October direct-Axiom addition is limited to the optional
dataset routing header, existing full HTTPS logs URL, and Bearer token; other
provider-specific configuration remains outside this scope.

## Open gates and release procedure

Evidence below was recorded on 22 October 2026. Each gate applies only to its
shipped slice; no resources/provider settings changed.

| Slice | Established | Remaining proof |
|---|---|---|
| 1 invitations | Documented recipients and pinned native lifecycle contract. | Prove the remaining [native active-role preservation and race cases](#native-invitations--slice-1); otherwise hold release and ask the user. No custom acceptance/activation registry. |
| 2 settings; 2.5 coordination; 3 MFA facts | Authenticated Supabase dashboard confirms the selected project's identity, Free plan, health/region, and current usage. Account eligibility is resolved. | Follow [owner setup](#owner-setup-for-supabase--slice-2); prove SQL isolation, capacity, TLS, persistence, and bounded failure behavior before rollout. Settings backup and restore proof belongs to Slice 4. Recheck usage then; connector access is no gate. |
| 3 MFA only | Standalone API and pinned SDK support unbound request shape. [Pricing](https://workos.com/pricing) includes native MFA and lists TOTP/SMS for all accounts. Connected WorkOS billing shows Pay as you go and a current $0 estimate, without explicit MFA entitlement. | Keep WorkOS pending explicit free production create/challenge/verify/delete confirmation for TOTP without `user_id`; neither native pricing nor the estimate establishes it. Prove AuthKit/MCP isolation and the existing proof/lifecycle/recovery rules. Role changes remain independent. |

Questions for WorkOS, not sent: Does native invitation acceptance preserve active
roles in the named cases? Are production create/challenge/verify/delete operations
for TOTP without `user_id` free, and can these factors affect AuthKit user-factor
lists or MCP sign-in? Do not substitute a native MFA flow that breaks the exemption.

### Selected Supabase PostgreSQL

Use the existing project **`rnqktgtgrvvqptbaosth`**, selected by the user with API URL
[https://rnqktgtgrvvqptbaosth.supabase.co](https://rnqktgtgrvvqptbaosth.supabase.co).
On 22 October 2026, the [authenticated project dashboard](https://supabase.com/dashboard/project/rnqktgtgrvvqptbaosth)
confirmed **Thermus AI** in
organization [Thermus](https://supabase.com/dashboard/org/jcizlbmzvltfcwponins),
**Free**, **Healthy**, **West US (Oregon) / `us-west-2`**, **Nano**, and no backups. The
[usage page](https://supabase.com/dashboard/org/jcizlbmzvltfcwponins/usage) for
22 October–22 November showed about 26 MB of 500 MB (5%) and egress 0 of 5 GB
with a reporting delay. This resolves project/account eligibility, not load,
SQL access, isolation, TLS, persistence, or recovery. Connector permission remains
denied but does not block implementation. Follow owner setup; touch no unrelated
data. WorkOS owns accounts/memberships; PostgreSQL holds only application facts:

| Slice | Durable facts |
|---|---|
| 1 | No new app database: existing provider metadata/external IDs hold creation/legal recovery. No Audit logs or MFA prerequisite. |
| 2 | OTLP destination endpoint, optional Axiom dataset, auth/enabled state, revision, and encrypted optional Bearer credential. No member-reduction coordinator yet. |
| 2.5 | Per-org serialized-operation and unknown external-write records that survive crashes/restarts. |
| 3 | Role changes reuse those records; MFA adds role-policy flags, factor associations, and scoped recovery state, never TOTP secrets. |

Thermus holds pending Slice 2 audit events, including tool content and
administration metadata, only in bounded memory until it sends or drops them.
It writes no audit history or event buffer to the PostgreSQL settings store.
Store no TOTP secrets or general session registry.

Use [Supabase Free operating limits](https://supabase.com/pricing): ongoing $0,
500 MB database, shared CPU/500 MB RAM, 5 GB egress, two active Free projects, no published monthly
compute-hour cap. It guarantees neither availability nor indefinite unattended
retention. [Seven days of low activity can pause it](https://supabase.com/docs/guides/platform/free-project-pausing);
operator resume has a current one-year window. Excess usage can make it read-only,
restrict, or pause service under [fair-use](https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy)
and [database-size rules](https://supabase.com/docs/guides/platform/database-size#free-plan-behavior).
Add no artificial keepalive, quota engine, or polling service.

Use plain SQL and Node `pg` through the included
[IPv4 session pooler and verified TLS](https://supabase.com/docs/guides/database/connecting-to-postgres).
Keep a restricted server role/private schema and portable storage operations;
another PostgreSQL must not require UI/account-contract changes. Add no Supabase
Auth, REST SDK, Edge Functions, ORM, self-run pooler, framework, or second adapter.

The storage owner must bound admitted/pending DB work, connection acquisition and
query durations, not just pool size. A caller timeout does not release outstanding
work from accounting: retain it until disposed, release or destroy late-acquired
clients, and ignore late results for the completed caller. Handle idle-pool errors
safely and release or destroy connections within the existing app shutdown
deadline. Test stalled
acquisition/query and idle disconnect with MCP still available; see
[`pg` pool](https://node-postgres.com/apis/pool) and
[client](https://node-postgres.com/apis/client) behavior.

Keep store operations narrow: atomic settings/revision Save; for Slice 2.5 member
removal and Slice 3 role changes, a committed per-org operation record **before**
the WorkOS effect. Use short SQL transactions, never held across remote calls.
Unknown writes block conflicts across restart/overlap. Later MFA switches compare
the expected factor association atomically. Reuse this store for later slices.
Prove database size, connections, applicable egress, and existing Render network
headroom; external SQL must add no unexpected cost.

**Owner scope decision, 24 October 2026:** run Slice 2 without settings backups.
Settings loss or encryption-key loss can require an Admin to re-enter the
destination and credential. Pending audit events have no history or replay, and
Slice 2 provides no settings restore service. This does not claim that provider
residual copies are available for recovery. Keep the application encryption key
secure for normal operation; configuring it is still required.

[Slice 4](#slice-4--settings-backup-and-recovery) owns regular scoped backups,
backup storage/custody/retention, separate key recovery, and restore proof. The
[future Slice 4 recovery procedure](../implementation/admin-s4-recovery.md)
is retained as future-work reference and historical drill evidence, not a
Slice 2 release prerequisite or present recovery guarantee.

Outage/pause stops export and sensitive storage-dependent writes; fresh portal
admission in the MFA branch fails closed. MCP and already-admitted portal product
access remain usable with current WorkOS identity/membership checks. Do not restart
healthy Node, cause health-check restart loops, or blanket MCP logout.
Update deployment/pause/quota/reconnect/recovery runbooks during implementation.

### Owner setup for Supabase — Slice 2

**Current setup observation, 24 October 2026:** original settings and additive
`axiom_dataset` migrations are applied; the restricted runtime role has LOGIN.
Real local production-store checks passed through the actual pooler: verified
client-to-pooler TLS, reconnect persistence, tenant predicates, encrypted
credential round trip, revision conflict and bounded query failure. Exact
canaries were removed; the settings table is empty. A local production sender
also reached Axiom `audit-log-test` and the manager verified its marker in the
Axiom UI. These are not the deployed current-Admin/browser/MCP journey.

Saving Render environment values unexpectedly deployed approved main
`845cec3060b0880cd27c36047f1da57a1c3772ba`, not the direct-Axiom candidate.
Auto-deploy remains off. The unreadable CA secret-file failure observed at about
23:37 UTC was repaired. The manager saved the official CA and deployed approved
main again as `dep-dbek395g1s2s73frt4i0`, live at 23:39:48 UTC. Startup no longer
reports storage unavailable; health was 200/ok at 23:40:10 UTC. This is configured
startup proof, not actual deployed SQL or the full release journey. Zero audit
destinations are enabled. Signup is currently enabled. Current
Production WorkOS inventory has one active verified password Admin and one User,
with an accepted invitation. Full candidate/code/notice approval and deployed
release proof remain pending. The [S2-04 ledger](../implementation/admin-s2-04.md#evidence-and-release-holds)
retains exact evidence, identifiers, timing and limits. The ordered steps below
describe initial setup; they do not direct reapplication of existing migrations.

Owner means the Thermus deployment operator with Supabase/Render access. This is
platform setup; customer Admins use Audit logs for Collector settings. S2-01a implements these server variables with validation and `.env.example`
placeholders. See the [implementation](../implementation/admin-s2-01a.md) and
[database owner runbook](../implementation/admin-s2-01a-database-setup.md). Missing values disable Slice 2 storage/export;
preserve MCP and already-admitted portal product access under the outage rule
above. Slice 1 needs no database setup.

| Variable | Server runtime value |
|---|---|
| `DATABASE_URL` | PostgreSQL URI for the selected project's restricted runtime role. |
| `LOGGING_DESTINATION_ENCRYPTION_KEY` | Independent cryptographically random 32 bytes, encoded as base64; stable across deploys and backed up outside the database. |
| `DATABASE_CA_CERT_PATH` | Optional, only if the actual endpoint needs a dedicated official CA file; for example `/etc/secrets/supabase-ca.crt`. |

Plain `pg` SQL needs none of the Supabase [publishable/secret or legacy
`anon`/`service_role` API keys](https://supabase.com/docs/guides/getting-started/api-keys),
`SUPABASE_URL`, or a CLI personal access token (PAT). WorkOS authenticates users.

1. Use the confirmed Thermus AI project above. Before DB integration, check
   isolation feasibility against its existing data. Recheck usage before rollout
   and keep added costs at $0; create/transfer/upgrade nothing. Connector OAuth is
   optional for Codex inspection, separate from PostgreSQL authentication; owner
   verification can supply the needed facts while connector access is denied.
2. The implementer then prepares reviewed S2-01 setup. Apply the reviewed [scoped migration](../../sql/migrations/20261023211956_logging_destination_settings.sql).
   The selected runtime role is `thermus_logging` and the private schema is
   `thermus_admin`; check that both names are unused in the existing database.
   The transaction fails on collisions and creates the role with `NOLOGIN`.
   Provision its own password securely, then enable `LOGIN`; give it only needed
   rights. Keep privileged owner/`postgres` credentials for setup, never the app;
   leave existing shared-project data untouched.
3. In [Connect → Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres),
   copy and recheck the selected project's details at rollout. The authenticated
   view showed host `aws-1-us-west-2.pooler.supabase.com`, port `5432`, database
   `postgres`, and free IPv4-proxied session pooling. That dated inspection
   tested no SQL connection. The S2-04 record now retains a TLS-only preflight
   and its verification limit; the direct IPv4 add-on is not needed. For the restricted role, use
   `thermus_logging.rnqktgtgrvvqptbaosth` and its URL-encoded role password. The supplied
   HTTPS API URL is not the DB URI. Require certificate
   and hostname verification: use default trust when valid, or the
   [official CA for that endpoint](https://supabase.com/docs/guides/platform/ssl-enforcement)
   if needed. Keep all query parameters and fragments out of `DATABASE_URL`. S2-01a explicitly
   configures verified `pg` TLS and rejects URL options,
   including `ssl`; examples are `sslmode`, `sslrootcert`, `sslcert`, and `sslkey`,
   which can [replace its SSL configuration](https://node-postgres.com/features/ssl).
4. Generate the independent key locally, for example with `openssl rand -base64 32`.
   Do not reuse a WorkOS/cookie secret. Keep the role password and stable key in the
   existing password manager/recovery storage. If a CA file is needed, confirm
   that the app can read its configured runtime path.
5. Open the existing [Render Thermus service](https://dashboard.render.com/web/srv-db8mnqg473hc739d529g),
   then [Environment → Add Environment Variable](https://render.com/docs/configure-environment-variables).
   Add only service-scoped server values. Do not assume an environment update
   stages values without deployment: the 24 October update triggered a deploy.
   Where the dashboard offers **Save only**, verify that action’s behavior before
   relying on it. **Save and deploy** redeploys the existing build;
   **Save, rebuild, and deploy** rebuilds it. For an optional public CA,
   use Secret Files → Add Secret File; **Save Changes triggers a deploy**. Coordinate
   it with rollout and verify the [Docker runtime path](https://render.com/docs/docker-secrets)
   `/etc/secrets/<filename>`. No environment group/config service is needed.
6. Before Slice 2 rollout, prove actual TLS/role/schema isolation, persistence, and
   the storage section's SQL bounds, outage, and $0 checks. Settings backup and
   restore are deferred to Slice 4.
   Handoff only nonsecret facts/configured variable names. Put no secret values in
   chat, Git, frontend, or build logs.

### Clean internal/test cutover — execute at S1-05

S1-02 prepares role/password implementation and the operator procedure. Execute
this cutover only after S1-03/S1-04, legal approval, and Slice 1 provider proof:

1. Inventory holders of reused environment roles and scoped test memberships.
   Choose explicit tester roles, never infer from names. Inventory retained
   identities' AuthKit enrollments/policies and non-password browser/provider
   sessions. Resolve conflicts through scoped operator setup, not an MFA UI.
2. Close affected hosted access **and writes**. End scoped retained non-password
   browser/provider sessions; do not rely on disabling Google alone to end old sessions.
   Retire old invitations/direct writers and clear scoped old application role
   assignments before changing shared definitions. Delete no identities.
3. Change mapper/provider definitions coherently. Check inherited/default
   permissions, automatic enrollment, and all holders of reused definitions.
   Default role grants no Thermus access; disable domain/JIT joining. Make only
   provider changes needed for password-only authentication. Add no staging role,
   activation registry, application policy flags, or debug bypass. Never silently
   clear real-customer factors.
4. Record the designated creator's approved agreement; bootstrap testers through
   native invitations. No implicit upgrade of old assignments.
5. Verify fresh password sessions, creation/join/selection, retired routes, and
   effective access before reopening. On failure, keep access/writes closed and
   repair; never revive old writers/grants against new roles.

### Verification and documentation

For source behavior, start with failing BDD acceptance, then focused TDD under
[AGENTS.md](../../AGENTS.md) and the [test gate policy](../implementation/test-gate-policy.md).
Use the canonical rules as specifications, including their concurrent/uncertain
cases. Select checks for the complete candidate and shipped capabilities; no
future-slice storage/provider/MFA gate is an earlier release prerequisite.
Review desktop/mobile, keyboard/screen readers, zoom, long values, empty states,
provider outages, and safe errors. Maintain the component registry when affected.

Update [onboarding](../implementation/hosted-user-onboarding.md),
[organization setup](../implementation/hosted-organization-setup.md),
[signup recovery](../implementation/hosted-signup-recovery.md), and portal design
with the relevant slice. Before Slice 2 export, approved privacy notice/Audit logs
help must explain input/result export. Slice 2.5 documents removal/uncertain-write
recovery; Slice 3 role changes extend those procedures, while MFA separately needs
validated identity/recovery steps and proof of retained-factor MCP safety.

Implementation follows the ticket checks below. A plan update alone needs manual
document, link, and mock checks; it does not execute provider changes or cutover.

## Appendix — implementation tickets

These IDs are plan-local, not external issues or implementation authorization.
Dependencies identify functional prerequisites; release exits also enforce
1 → 2 → 2.5 → 3. Each ticket follows the canonical rules, free-only rule, and
verification procedure above. S1-03 and S1-04 remain group references: each is
complete only when both of its child tickets are complete.

### Refined tabs UI — approved design, 26 October 2026

**Status: UI-01, UI-02 and UI-03 have candidates in PR #263, #264 and #266.
UI-03 is now stacked on UI-02; UI-04 is next to restack.** These four small,
plan-local tickets implement the selected Members presentation against existing
member, invitation, and removal behavior. They add no provider or MFA feature
and have no Slice 3 dependency. They do not reopen completed Slice 2.5 release
work. Implement them serially: they share rendering/style and acceptance files.
UI-02/03/04 depend functionally on UI-01, not on each other. The serial order below
avoids conflicting edits; no separate verification-only ticket is needed. UI-01
can finish while the current invitation form and pending section remain visible.
Each ticket must leave a working page; later tickets are not its exit conditions.

| Ticket | Dependencies | Result |
| --- | --- | --- |
| [UI-01](#ui-01--shared-admin-shell-and-layout) | Current Members/Audit logs routes and trusted access | Modest shared shell, visible page links, Members workspace context and full-width content. |
| [UI-02](#ui-02--member-rows-and-quiet-removal) | Current checked removal; UI-01 | Aligned identity/role/action rows and quiet native Remove…/Leave… confirmations. |
| [UI-03](#ui-03--on-demand-invitation-form) | Current native invitation routes; UI-01 | Closed initial invitation disclosure and one explicit Send invitation. |
| [UI-04](#ui-04--compact-pending-invitations) | Current complete invitation overview; UI-01 | Counted pending disclosure, compact rows, UTC expiry and existing allowed actions. |

**Deep review corrections — 26 October 2026.**

| Finding | Decision |
| --- | --- |
| The shared exit gate required UI-03/04 features before those tickets existed. | Validate the current ticket and earlier work; check the combined page when all four tickets are complete. |
| The new row count could replace the product-seat fact used by billing and access tests. | Keep both clearly labelled counts from the existing overview; preserve seat semantics and tests. |
| Old sentence, label and form-order assertions were missing from the migration scope. | The ticket that changes the markup also updates its consumers, including offline WorkOS and hosted-live tests. |
| The browser driver defaults to 390px with JavaScript on. | Set 320px/desktop and JavaScript modes explicitly; use fresh fixtures for each scenario. |
| Some BDD cases combined cancel, submit, or failed reads into one journey. | Separate the outcomes; add the successful invitation journey and a real later-page failure. |
| The open-form mock moved Pending invitations before members. | Use the same section order in every state; scope Members body styles so Audit logs keeps its controls. |

Start each ticket with executable BDD through public HTTP or real browser
interfaces. Run the cases for new behavior before source changes and record the
actual initial red result. The expected gaps below come from source inspection,
not test runs. Existing behavior and changed test selectors can remain green;
do not manufacture red results for them. Then use each
focused failing test → minimum implementation → green refactor cycle below until
the acceptance cases are green. If a preceding step already makes a case pass,
keep it as passing coverage; do not force another failure. Select tests by
subject, not quotas. Rendering
and route contracts use the existing integration tests named below: they connect
real Web/account rendering/routes and their public collaborators. No new renderer
unit suite is required. A unit test, if needed for a focused local rule, replaces
other Delamain packages at their public interfaces. Real disclosure, keyboard,
native validation and layout behavior need browser acceptance. Do not add
CSS-class-string snapshots, unit functions for CSS geometry, or tests of this plan.

**Test migration and fixtures.** Each ticket updates the assertions and helpers
that consume its changed presentation. Find forms by action and target fields in
HTTP tests; keep explicit label assertions when wording is the subject. Browser
tests use accessible names and scope actions to the chosen member or invitation.
Replace incidental form indexes, sentence matching and exact row-class extraction
in affected cases with assertions of the same facts. Do not remove safety checks,
weaken expected outcomes, or build a general UI test framework.

In addition to the ticket pointers, trace
[hosted-administration](../../test/integration/auth/hosted-administration.test.ts),
[offline WorkOS administration](../../test/acceptance/auth/hosted-workos-administration.test.ts)
and [hosted-live administration](../../test/acceptance/auth/hosted-live/administration-server.ts).
UI-02 owns row/self-action migrations; UI-03 owns Invite → Send invitation;
UI-04 owns pending-row migrations. Preserve the `seatsIn` product-count meaning in
[the administration DSL](../../test/support/dsl/hosted-administration.ts),
[hosted-seats](../../test/acceptance/auth/hosted-seats.test.ts) and
[hosted-billing](../../test/acceptance/billing/hosted-billing.test.ts). Never change
all expected six-seat results to seven because the row heading changed.

Reuse [the browser site](../../test/support/in-process/hosted-member-removal-site.ts)
with `setUp(world)` for fresh self/other, pending, long-value and last-Admin states.
Use the existing browser driver with explicit `javaScriptEnabled` and
`setViewportSize`; the 390px/JavaScript-on defaults do not prove the planned cases.
Inspect actual visibility, keyboard focus, bounds, native validity, request
counts and resulting state. HTTP form parsing alone cannot establish those facts.

#### UI-01 — Shared admin shell and layout

Implemented in [PR #263](https://github.com/tomer-mayara/Thermus/pull/263).
The [implementation record](../implementation/admin-ui-01.md) links validation
and review evidence. This status does not claim a merge or deployment.

**BDD acceptance first.**

```gherkin
Scenario: Keep workspace context beside page navigation
  Given a current Admin in the named workspace Acme Labs
  When the Admin opens Members and follows Audit logs and Members
  Then Connect, Members, Audit logs and Switch workspace remain real page links
  And only the current page link has aria-current="page"
  And Members shows Acme Labs beside Switch workspace
  And Members uses the available content width for its list
Scenario: Use the shell without JavaScript at narrow and desktop widths
  Given the built portal assets and JavaScript disabled
  When an Admin opens Members at 320px and desktop width and uses the keyboard
  Then navigation, the skip link, focus and workspace text remain usable
  And long values and the current page content reflow without horizontal scrolling
```

**Initial red to observe.** Add the first acceptance assertion for named workspace
context beside Switch workspace: the current shell has no name there. Record a
browser acceptance failure for the new full-width/modest-title layout before CSS
changes; do not assert a class name to represent this behavior.

**Focused TDD.**

1. Add a failing integration rendering/route test for the Members name beside
   Switch workspace → pass the trusted `MemberOverview.organizationName` to the
   internal layout, including escaping → make it pass and refactor.
2. Use focused failing browser assertions for full-width content and narrow
   navigation → change the minimum layout/CSS → make them pass and refactor.
   Inspect the 32px serif title, sans labels, local fonts and 48px controls in
   browser evidence. Do not create a unit abstraction for CSS geometry.

**Characterization, which may already pass.** Preserve links under the configured
base path, current-page semantics, escaping, skip/focus navigation, non-cacheable
responses, and CSP hashes derived from the actual embedded style/script. Audit
logs inherits shell typography/navigation/spacing only. Scope Members body styles
so Audit keeps its controls, help, context behavior, Save/Test handlers, result
availability and optional script. The CSP policy stays equally restrictive; its
style hash must follow changed CSS bytes, not remain byte-for-byte identical.
Do not add a workspace-name lookup, LoggingRoutes option, or provider failure path
for its chrome; do not display a tenant ID as a workspace name. Connect is a link
here; its body redesign is outside scope.

**Owner and pointers.** Web/account owns
[members-page-layout.ts](../../src/interfaces/web/account/members-page-layout.ts),
[members-style.ts](../../src/interfaces/web/account/members-style.ts),
[administration-pages.ts](../../src/interfaces/web/account/administration-pages.ts),
and the existing data handoff in
[administration-routes.ts](../../src/interfaces/web/account/administration-routes.ts).
Inspect the shared consumer
[logging-page.ts](../../src/interfaces/web/account/logging-page.ts), without adding
logging lookups. Extend
[hosted-members.test.ts](../../test/acceptance/auth/hosted-members.test.ts),
[account-routes-administration-pages.test.ts](../../test/integration/hosted-admin/account-routes-administration-pages.test.ts),
and [hosted-member-removal-browser.runtime.ts](../../test/acceptance/auth/hosted-member-removal-browser.runtime.ts).
Retain focused [logging-page](../../test/unit/html/logging-page.test.ts) and
[logging-routes](../../test/unit/html/logging-routes.test.ts) checks for the shared
consumer. The browser driver is
[member-removal-browser.ts](../../test/support/drivers/browser/member-removal-browser.ts).

**Complete when** the shell acceptance is green with JavaScript on and off,
Members workspace context is truthful, Audit behavior is unchanged, and the
[candidate validation gate](#ui-shared-final-validation-gate) passes. UI-03/04
disclosures are not required to complete UI-01.

#### UI-02 — Member rows and quiet removal

Implemented in [PR #264](https://github.com/tomer-mayara/Thermus/pull/264),
stacked on UI-01. See the [implementation record](../implementation/admin-ui-02.md).

**BDD acceptance first.**

```gherkin
Scenario: Read active member facts and choose a deliberate action
  Given a complete overview with seven active members, six of whom have product access
  When the Admin opens Members
  Then Member, Role and Action facts are aligned and Members shows seven active rows
  And Active product members still shows six from the existing product-access count
  And You is beside only the trusted current identity and roles are read-only
  And each removable other member has a quiet Remove disclosure with a specific name
  And a removable current member has a quiet Leave disclosure with a specific name
Scenario: Cancel removal without JavaScript
  Given a removable member and JavaScript disabled
  When the Admin opens that member's disclosure by keyboard
  Then confirmation names the person and workspace and states retained account and other access
  And only the final removal confirmation is red
  When the Admin follows Cancel
  Then Members opens with the disclosure closed and no removal request or state change
Scenario: Confirm removal without JavaScript
  Given a fresh page for an eligible member removal, another active Admin will remain and JavaScript is disabled
  When the Admin opens that member's disclosure and submits one valid confirmation
  Then only that membership is removed, with one removal POST
  And the account and other workspace memberships remain
  And Member removed is shown with recovery links and no repeat-removal form
```

**Initial red to observe.** The current rows express identity/status/roles in a
sentence; the self trigger says Remove rather than Leave. Add and run the new
self-action/row-fact acceptance first. Quiet emphasis and column alignment need
an initial browser acceptance observation, not a class-string test.

**Focused TDD.**

1. Add a failing integration case for labelled row facts and the seven-row heading
   beside the retained six-product-member caption → render existing overview
   facts without new reads → make it pass and refactor. Migrate sentence/row
   assertions while keeping product-seat assertions unchanged.
2. Add a failing integration case for self Leave and other Remove names → use the
   trusted subject and existing `removable` decision for native disclosures →
   make it pass and refactor. Keep absent/unknown roles and duplicate-email
   identities in the cases; an email match cannot identify You or self-removal.
3. Use a focused failing browser check for aligned rows and quiet triggers →
   apply the minimum row/action CSS → make it pass and refactor. Close the outer
   BDD loop with fresh self/other keyboard cancel and submit cases, including
   self-removal with another active Admin. Inspect wrapping, final danger color
   and 48px targets; retain the existing refusal/recovery characterizations.

**Characterization, which may already pass.** Retain the visible product count
and its deduplication, access and read-failure rules; it is not the row count.
Retain exact CSRF, organization, membership and revision fields. Preserve all
active rows, including unsupported
or absent roles; only mutation controls depend on the existing `removable`
decision. Preserve authoritative stale, last-Admin, busy, unavailable and
unconfirmed results; one checked POST; no retry on unknown. The overview omits
permission grants, so never disable Leave by
counting displayed Admin labels or add grants/provider lookups. Preserve
Read current Members and the warning that it does not confirm the operation.
Keep safe self-removal selection/sign-in recovery, account/other-membership
preservation, no Undo, and the full approved help. Its current version is
`hosted-members-help-organization-removal-proposal-2026-10-26-v1`; SHA-256 is
`853d344d0f861fd3a53ed05b846909108d56d39d6105a7fa4fcc626e0d1aa9ca`.
Preserve exact text and metadata, not a rewritten summary.

**Owner and pointers.** Web/account owns row/removal rendering in
[administration-pages.ts](../../src/interfaces/web/account/administration-pages.ts)
and [members-style.ts](../../src/interfaces/web/account/members-style.ts).
[account-pages.ts](../../src/interfaces/web/account/account-pages.ts) owns fixed
outcomes; [administration-help-documents.ts](../../src/interfaces/web/account/administration-help-documents.ts)
owns help bytes. The domain remains unchanged in
[administration-overviews.ts](../../src/accounts/organizations/administration-overviews.ts)
and [membership-removal.ts](../../src/accounts/organizations/membership-removal.ts).
Extend the UI-01 Members/route/browser tests. Characterize existing
[hosted-member-removal](../../test/acceptance/auth/hosted-member-removal.test.ts),
[hosted-member-self-removal](../../test/acceptance/auth/hosted-member-self-removal.test.ts),
and [hosted-member-session-recovery](../../test/acceptance/auth/hosted-member-session-recovery.test.ts)
through [hosted-member-removal.ts](../../test/support/dsl/hosted-member-removal.ts).

**Complete when** the new row/Leave acceptance and preserved removal outcomes are
green, approved help is unchanged, browser review shows quiet actions and usable
expanded rows, all affected row/self-action test consumers are migrated, and the
candidate validation gate passes. No later invitation UI is required.

#### UI-03 — On-demand invitation form

**Candidate: [PR #266](https://github.com/tomer-mayara/Thermus/pull/266), stacked
on UI-02.** See the [implementation record](../implementation/admin-ui-03.md).
This candidate includes the parent member rows, both counts and compact removal actions.

**BDD acceptance first.**

```gherkin
Scenario: Invite only after opening the task
  Given a current Admin for whom User and Admin are both invitable and JavaScript disabled
  When the initial Members GET opens
  Then Invite member is a closed native disclosure beside the heading
  When the Admin opens it by keyboard
  Then one email field and User/Admin choices appear with User selected
  And the recipient-policy note is visible before Send invitation
  And the open trigger is neutral and Send invitation is the only orange action
Scenario: Discard a draft invitation without a write
  Given a fresh open invitation form with a typed email and Admin selected
  When the Admin follows Cancel
  Then a fresh Members GET shows the closed form and no invitation was sent
Scenario Outline: Send one invitation from the disclosed form
  Given a fresh Members page where <role> is invitable and JavaScript disabled
  When the Admin opens Invite member, enters a valid new email, selects <role> and submits once
  Then one protected invitation POST is sent with that email and role
  And the applied result redirects with 303 to Members with the invitation form closed
  And the new pending invitation has that role without claiming email delivery
  Examples:
    | role  |
    | User  |
    | Admin |
Scenario: Reject invalid email before a request
  Given a fresh open invitation form
  When the Admin submits an invalid email in a real browser
  Then native validation prevents submission and retains the typed values
Scenario Outline: Keep existing notices for server outcomes
  Given a fresh valid invitation form and a server result of <outcome>
  When the Admin submits once
  Then the existing fixed notice and safe recovery appear without a restored form or unsafe retry
  Examples:
    | outcome     |
    | refusal     |
    | unconfirmed |
Scenario: Find the invitation task after last-Admin refusal
  Given the existing last-Admin refusal page
  When the Admin reads its Invite another Admin recovery guidance
  Then an instruction explains to open Invite member, select Admin and wait for acceptance
  When the Admin follows that existing link and opens Invite member on Members
  Then the ordinary invitation form is usable without JavaScript or recovery state
```

**Initial red to observe.** The current invitation form is always visible and its
submit label is Invite. Add the closed-initial-disclosure/Send invitation
acceptance first; run it to observe failure before the markup change. Use a real
browser for hidden content and native validation, not the HTTP driver's form list.

**Focused TDD.**

1. Add focused failing integration cases for the closed disclosure, Send invitation
   label and Cancel GET link → wrap the existing protected form in native Details
   → make each case pass and refactor. Keep no-trigger/no-form for an empty role
   list as passing characterization. Migrate Invite-label consumers in this
   ticket, keeping their send/role checks.
2. Add a failing integration case for the last-Admin recovery instruction → add
   the instruction beside the existing link → make it pass and refactor. Preserve
   the recovery route/redirect; users open Invite member on the resulting page.
3. Check the open trigger's neutral emphasis and form placement in the browser.
   For a remaining gap, record a focused failure → apply the minimum CSS → make
   it pass and refactor. Keep an already passing check green. Run
   the outer BDD with actual keyboard opening, typed Cancel and one successful
   submission for each role. Retain native validation and server-notice coverage.
   Closing the summary retains native focus behavior; Cancel is document
   navigation. Add no modal, state store, script or custom focus-return flow.

**Characterization, which may already pass.** Keep email `maxlength="254"`, native
labels/validation, default User when available, the allowed role subset, escaping,
CSRF/scope fields and no-JavaScript POST. Preserve both existing identity-policy
texts without a WorkOS-specific branch or inferred company/personal rule.
Applied and unchanged results, including an unchanged duplicate invitation,
retain their 303 redirect to Members. Preserve the existing denied, stale,
not-pending, address-in-use, unsupported and invalid-input notices, and the
unconfirmed notice without a retry form. Add no new rate-limit outcome. Only
native pre-submit validation retains values; server-error form restoration is
outside scope. A pending record does not prove email delivery.

**Owner and pointers.** Web/account owns `sendForm`/policy text in
[administration-pages.ts](../../src/interfaces/web/account/administration-pages.ts),
[members-style.ts](../../src/interfaces/web/account/members-style.ts), and recovery
instructions in [account-pages.ts](../../src/interfaces/web/account/account-pages.ts).
Preserve [account-form.ts](../../src/interfaces/web/account/account-form.ts) and
[administration-routes.ts](../../src/interfaces/web/account/administration-routes.ts)
contracts. Extend the UI-01 Members/route/browser cases; characterize
[hosted-invitations.test.ts](../../test/acceptance/auth/hosted-invitations.test.ts),
[hosted-invitation-refusals.test.ts](../../test/acceptance/auth/hosted-invitation-refusals.test.ts)
and [account-routes-administration-input.test.ts](../../test/integration/hosted-admin/account-routes-administration-input.test.ts).
Reuse [hosted-administration.ts](../../test/support/dsl/hosted-administration.ts)
and the existing real browser driver; do not treat the HTTP driver as CSS proof.

**Complete when** initial/open/valid/invalid-browser/server-notice/recovery cases
pass, browser interactions work with JavaScript on and off, policy and protected
forms are unchanged, Invite-label consumers are migrated, and the candidate
validation gate passes. The current pending list can show the new invitation;
UI-04's counted disclosure is not needed yet.

#### UI-04 — Compact pending invitations

**BDD acceptance first.**

```gherkin
Scenario: Discover all current pending invitations
  Given a successful complete invitation overview with pending and terminal entries
  When Members opens
  Then Pending invitations shows the complete pending count and starts open when nonzero
  And only pending entries show their role, absolute UTC expiry and currently allowed actions
Scenario: Keep a successfully read empty group small
  Given a successful complete overview with no pending invitations
  When Members opens
  Then Pending invitations shows zero in a closed native disclosure
  And opening it explains that no invitations are pending
Scenario: Do not present a partial read as empty or complete
  Given an invitation read whose later page fails after an earlier page returned entries
  When Members opens
  Then the existing failure is shown with no partial list or count
```

**Initial red to observe.** The current pending section is a permanent card with
no counted disclosure. Add and run zero-closed/nonzero-open/count acceptance before
source changes. Failure is expected from that missing behavior, not an invented
failure of existing expiry or resend/revoke rules.

**Focused TDD.**

1. Add focused failing integration cases for the filtered count and zero-closed/
   nonzero-open states → use the complete existing collection and native Details
   without another read or stored counter → make each case pass and refactor.
2. Use a focused failing browser check for compact, long-value pending rows at
   320px → change the minimum markup/CSS → make it pass and refactor. Migrate
   pending sentence/row assertions, preserving role, expiry and action checks.
   Close the outer BDD with keyboard discovery and the existing Resend/Revoke
   flows. Keep UTC `time` semantics; add no relative clock or new confirmation.

**Characterization, which may already pass.** Retain complete-read failure
behavior, pending-only entries, roles, machine-readable expiry, scoped protected
Resend/Revoke forms, current allowed actions and fixed result notices. Keep
unconfirmed status guidance and no delivery claim. Do not add invitation history,
new lifecycle/provider policy, or hidden nonzero pending rows. Exercise a later
page failure through the public route with the existing directory fixture; do
not invent a partially successful `InvitationOverview`. That contract is complete.

**Owner and pointers.** Web/account owns pending rendering in
[administration-pages.ts](../../src/interfaces/web/account/administration-pages.ts)
and [members-style.ts](../../src/interfaces/web/account/members-style.ts).
Accounts owns the unchanged complete projection in
[administration-overviews.ts](../../src/accounts/organizations/administration-overviews.ts).
Extend the UI-01 Members/route/browser tests and preserve
[account-routes-administration-changes.test.ts](../../test/integration/hosted-admin/account-routes-administration-changes.test.ts)
and [organization-administration-invitation-overview.test.ts](../../test/unit/organizations/organization-administration-invitation-overview.test.ts).

**Complete when** counted zero/nonzero states, keyboard discovery, complete-read
failure and existing lifecycle behavior pass, compact rows reflow, pending-row
consumers are migrated, and the candidate validation gate passes. When this is
the last of the four tickets, also inspect the combined page as described below.

#### UI shared final validation gate

**Per candidate.** Check the current ticket and preserve earlier behavior. A
later ticket's feature cannot block an earlier ticket. Record actual red → green
evidence for new behavior; selector migrations and unchanged characterizations
need a passing result, not an artificial failure. Run the selected focused checks
and then the complete candidate checks. Reuse the
[test layout](../testing/test-code-layout.md) and
[test gate policy](../implementation/test-gate-policy.md). A source change needs
`npm test`, `npm run typecheck`, `npm run build:user-portal`, and applicable dedicated
gates. Changes under `src/interfaces/web/` also select `npm run test:container`,
`npm run build:hosted`, and the Linux AMD64 `npm run test:container:hosted` gate.
Do not add `npm run check`. Removal form, confirmation, or result-navigation
changes select the Members browser gate; an updated runtime test file also
selects its own gate. The Members browser command is
`npm run build:user-portal && npm run build && node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
Run each changed test locally; record environment limits or deferral explicitly.
Layout alone does not select SQL, Collector or live provider proofs. Still trace
changed tests/helpers to their consuming groups: a changed hosted-live assertion
or helper can require its dedicated staging group. Actual authentication or
WorkOS read/write changes also follow the hosted-live source gate. Apply the
policy's prerequisites and nested-run limits; an unavailable required run is
deferred, not passed. These tickets authorize no production fixture changes.

Use real built assets. Set JavaScript enabled/disabled and 320px/1280px widths
explicitly for the ticket's browser cases. Use long values, keyboard navigation,
text zoom and expanded content where relevant. Inspect computed text/boundary/
focus contrast and 48px action targets, with screenshots or manual observations.
HTTP/DOM checks cannot prove CSS geometry, hidden content or native validation.
Update the browser gate's documented scope when its implemented cases change.

| Candidate | New browser behavior to prove, alongside existing regressions |
| --- | --- |
| UI-01 | Workspace/nav layout, full-width content, skip/focus and reflow; Audit shell without changed body behavior. The existing invitation/pending sections may remain. |
| UI-02 | Labelled rows, two distinct counts, self/other quiet disclosures, cancellation with no write and one confirmation with existing recovery. |
| UI-03 | Initial/open invitation, typed Cancel, invalid native input, valid User/Admin submission and last-Admin recovery instructions. Existing pending rows are sufficient. |
| UI-04 | Zero/nonzero pending disclosure, long rows, allowed actions and stable section order. |

**Combined finish.** When all four tickets are present, inspect one complete
Members page through the new states above with JavaScript on/off at both widths.
Include expanded approved help and fixed server notices, and retain the existing
session/self-removal recovery coverage. Check Audit logs after the final shared
CSS changes: controls, help, optional script and Save/Test behavior still work.
Reuse current passing evidence; repeat checks only for a changed candidate or
an unresolved concern. Do not add a separate verification ticket or require new
provider writes merely to review the combined layout.

Before Ready, review the complete diff, required documents, architecture impact,
component registry, public-surface snapshots when applicable, habit-hooks, metrics,
review tier and merge eligibility under repository policy. No release, provider,
legal-copy, or human-approval gate is waived by this design selection. This plan
edit itself needs document/link review, not source tests or provider checks.

### Slice 1 — Basic password Admin portal

| Ticket | Depends on | Result |
|---|---|---|
| [S1-01](#s1-01--shared-boundary-and-retired-grant-writes) | None | Narrow shared contracts and retire unsafe grant writes. |
| [S1-02](#s1-02--useradmin-password-access) | S1-01 | User/Admin password access without inferred MFA proof. |
| [S1-03a](#s1-03a--named-creation-agreement-and-first-admin) | S1-02 | Named creation, approved agreement, and confirmed first Admin. |
| [S1-03b](#s1-03b--creation-recovery-and-eligibility) | S1-03a | Safe recovery, eligibility, and no replayed grants. |
| [S1-04a](#s1-04a--members-and-native-invitation-management) | S1-02 | Members and native send/resend/revoke. |
| [S1-04b](#s1-04b--invitation-acceptance-and-trusted-landing) | S1-02 | Recipient acceptance, trusted landing, and provider proof. |
| [S1-05](#s1-05--complete-journey-verification-and-cutover) | S1-03, S1-04 | Complete journey, approved documents, verification, and scoped cutover. |

**Execution rule for every Slice 1 ticket.** This plan specifies the full journey
now. Each ticket writes executable acceptance before its own new behavior and
brings it green in the same candidate: confirm the intended failure, add focused
failing unit/interface/integration coverage, implement the minimum change, then
refactor green. Use Given–When–Then names in the existing `node:test` runner;
these Gherkin blocks add no runner or test-type quota. Refactors and already-covered
outcomes use passing characterization, never manufactured failures.
Add/reuse the combined S1-05 executable journey when its dependencies are ready;
it may already pass. Do not keep a failing whole-slice ordinary test across
tickets, or hide failure with skips, todo, or exclusion. Any missing behavior
needs its own failing acceptance and focused TDD in the owning ticket before a fix.
The gap notes below are observations, not executed red/green results.

Reuse public-interface doubles, DSL, drivers, and sites under the
[test layout](../testing/test-code-layout.md); add support only when needed. Unit
tests isolate other packages; real cross-package collaboration is integration.
Provider configuration/evidence, legal approval, cutover, and document review
use appropriate live/manual checks, not source tests for configuration or prose.
Update affected ordinary/live assertions, fixtures, and documents with each owning
behavior; do not defer obsolete assumptions to S1-05.
Run new/changed focused tests during implementation. Before Ready, select checks
from the complete candidate: `npm test`, `npm run typecheck`,
`npm run build:user-portal`, and applicable [gates](../implementation/test-gate-policy.md).
Do not repeat full checks for each substep. Add no redundant
`npm run check`. Follow [AGENTS.md](../../AGENTS.md) for habit-hooks, component
registry, architecture/quality review, and review eligibility. No checks described
here have run for this plan revision. Slice 1 adds no database or later-slice
Audit logs, member reduction, role-change, or MFA feature.

#### S1-01 — Shared boundary and retired grant writes

Implementation and verification are tracked in the
[S1-01 record](../implementation/admin-s1-01.md). The gap below describes the
starting code; the record gives the current candidate's results and limits.

**Acceptance specification first:**

```gherkin
Scenario: Retire a formerly authorized User-grant write
  Given a legacy-authorized Admin with completed MFA and current membership
  And a valid same-origin User-grant form with CSRF token and current revision
  When the Admin submits it to the retired /members/grants path
  Then the path is unavailable and no membership or role write occurs
```

**Gap at the start.** The path, grant forms, `changeGrant`
service, and provider writer still exist. The retirement case should fail on that
behavior. Moving types is separate: signup/session contracts and safe wire
responses already work and must stay green during those moves.

**Ordered TDD steps:**

1. Write and run the retirement acceptance before the contract refactor. Confirm
   it is red because the authorized old write still succeeds. Establish passing
   characterization of the affected signup/session responses:
   identity/profile display, safe return paths, cookies on success/refusal/outage,
   CSRF, and closed signup. Reuse existing cases rather than freeze private calls.
   Move `SignupActivation`, documents, states/results into accounts and update
   consumers with no behavior change; compile and keep characterization green.
2. Define only the shared session/profile operations that callers need, replacing
   `Pick<WorkOSBrowserSession>` and provider signed-session types at shared
   boundaries. Keep SDK/seal/callback details in the adapter. Preserve display
   data as display data and cookie effects on every response. This refactor stays
   green; it needs no invented failing feature case.
3. Add focused failing retirement boundary tests, then remove the grant forms,
   route, parser/service operation, and direct adapter mutation path. Keep the
   authorized valid submission so an unrelated authentication/CSRF refusal cannot
   hide the writer. Keep no alternate public writer or compatibility route.
4. Verify composed form destinations under root and nested public paths, escaping,
   and same-origin checks. Add focused behavior coverage only for a real gap.
   Review imports/exports with existing lint/type/manual checks, not file-parsing
   tests. Refactor after all retained safe behavior and retirement cases are green.

**Homes and anchors.** Start at [signup contracts](../../src/accounts/providers/workos/workos-signup.ts),
[session routes](../../src/interfaces/web/auth/workos/workos-session-routes.ts),
[shared session](../../src/accounts/identity/browser-session.ts), and
[administration routes](../../src/interfaces/web/account/administration-routes.ts).
Reuse `test/integration/auth/workos-signup-routes.test.ts`,
`test/integration/auth-workos/` session-route cases,
`test/integration/hosted-admin/` route cases, and hosted acceptance under
`test/acceptance/auth/`. Keep provider-specific tests at the adapter boundary.

**Done.** The retirement scenario passes; contract moves preserve characterized
outcomes; shared UI/contracts expose no SDK/seal/provider-session types.

#### S1-02 — User/Admin password access

Implementation and verification status: [S1-02 record](../implementation/admin-s1-02.md).
The gap below describes the starting candidate; the record gives the observed
red/green results and the remaining verification limits.

**Acceptance specification first:**

```gherkin
Scenario Outline: Password access follows the current role
  Given an active <role>-only membership and password sign-in
  When that person opens product/MCP and existing members/invitation operations
  Then product/MCP works and those administration operations are <administration>
  Examples:
    | role  | administration                   |
    | User  | denied                           |
    | Admin | allowed, including either invite role |

Scenario Outline: Access requires current grants in the requested organization
  Given <membership state>
  And the person has valid access to B
  When the person requests protected access in A
  Then A is denied without protected work and authorized B access remains usable
  Examples:
    | membership state                         |
    | only default/unknown grants in A          |
    | an inactive membership in A               |
    | no membership in A, including after removal |
    | membership only in foreign organization B |

Scenario Outline: Discard inferred MFA evidence
  Given legacy Required-policy inference-enabled composition
  And <starting condition>
  And no verified MFA completion
  When <operation> completes
  Then the session reports no MFA completion
  Examples:
    | operation           | starting condition |
    | password sign-in    | a fresh password callback |
    | session read        | a retained inferred mfa:true cookie |
    | refresh             | a retained inferred mfa:true cookie |
    | workspace selection | a retained inferred mfa:true cookie |
```

**Starting gap / observed red.** The earlier mapping gave Admin no product
permission and used Super Admin for Admin invitations. Administration required
MFA; composition inferred proof from Required-policy Password sign-in and masked
proof in Optional mode. The Admin-only acceptance and legacy Required/inference
cases failed before the source edits. Fresh callbacks and retained `mfa:true`
cookies now discard that inference. Optional/unproven cases already discarded
proof and stayed characterized. This adds no new MFA feature.

**Ordered TDD steps:**

1. Add the failing Admin-alone product/MCP case. Drive the two-role mapping with
   focused mapping/access tests; remove the customer Super Admin requirement.
   Check default/unknown application permissions and invalid catalogs fail closed.
   Current membership reads still decide access, not cookie role claims.
2. Add password-only Admin list/invitation authority cases and User refusals.
   Change the domain checks so Admin manages either invitation role. Remove the
   shipped `managedBy`/`billingState` MFA preconditions without adding billing work
   or bypassing current organization, permission, origin/CSRF, or stale checks.
3. Add regressions for fresh password callbacks and retained inferred-proof
   cookies across read, refresh, and workspace selection. Remove the inference
   and masking modes; discard inferred evidence, never mark MFA complete without
   verification. Add no admission marker, policy flags, factor state, or MFA UI.
4. Update composition and affected fixtures/tests to the new role/password model.
   Update Admin-only signup eligibility now: product access means Continue, not a
   new User workspace. Update affected hosted-live role/MFA assumptions with this
   change, preserving their unrelated safety checks. Correct Admin/product copy
   and User-only seat-summary/count assertions, or remove the obsolete summary;
   add no billing feature.
   Keep callback/state/PKCE, cookie protection, logout, outage recovery, and
   browser/MCP workspace separation green. Prepare the scoped role/password
   cutover procedure. Rollout/cutover changes wait for S1-05; scoped staging
   fixtures/configuration can support earlier verification. This planning revision
   authorizes neither.

**Homes and anchors.** Use [role mapping](../../src/accounts/providers/workos/hosted-role-mapping.ts),
[organization authority](../../src/accounts/organizations/organization-administration.ts),
[sign-in](../../src/accounts/providers/workos/workos-sign-in.ts), and
[composition](../../src/app/hosted-workos-application.ts).
Use focused `test/unit/auth-workos/` and `test/unit/organizations/` cases,
`test/integration/auth/` access/session cases, and hosted acceptance. Update
`hosted-workos-mfa-policy.test.ts` and old-role cases rather than keep contradictory
expectations. Fake-backed code exchange is not provider password proof: retain
email-verification/password-reset requirements for applicable live/manual checks.

**Done.** The role/password acceptance passes with current denial/error checks.
Safe password/session behavior remains; no application MFA gate or inferred proof
remains. Rollout/cutover waits for S1-05.

#### S1-03a — Named creation, agreement, and first Admin

Implementation and verification status: [S1-03a record](../implementation/admin-s1-03a.md).
The gap below describes the starting point; the record keeps observed test results
and the remaining rollout limits.

**Acceptance specification first:**

```gherkin
Scenario: Offer name and an unchecked agreement
  Given an eligible signed-in person with verified identity
  When the creation page opens
  Then the organization name is editable and the one approved agreement is unchecked

Scenario: Create the agreed organization and open its guide
  Given an eligible verified person, the name Acme Labs, and the accepted agreement
  When that person submits the creation form
  Then confirmed creation gives that subject first Admin
  And the saved record contains the organization and approved authority/legal facts
  And the persisted organization is named Acme Labs
  And a current-membership browser switch opens that organization's MCP guide
  And the workspace context displays Acme Labs
  And the selected-session and guide organization IDs match the created organization
```

**Original gap / observed red.** Before source changes, both S1-03a acceptance
tests failed: the name input was absent and the named POST returned 400. Signup
used a fixed personal-workspace name and granted User. Its agreement/recovery behavior is useful but does
not implement named organization creation, the revised authority agreement, and
first Admin. The current approved personal-User terms cannot serve as the revised
organization bundle. These are the new behavior gaps, not failed legal approval.
Tests can use the marked `test/support/fixtures/signup-documents.ts` bundle;
that does not approve production wording, which must be the exact newly approved
organization/authority bundle before rollout.

**Ordered TDD steps:**

1. Add the creation acceptance case through the real hosted form. Drive name
   validation and the single checked-on-submission agreement with focused form
   tests, including unchecked/missing/duplicate/invalid input and stale document
   version; refused input causes no provider writes. Tests may use the marked
   legal fixture; production must use the exact approved new wording before rollout.
2. Extend the shared signup request and adapter to carry the valid name and
   canonical legal/authority facts. Save the creator subject, organization,
   versions, hashes where required, and time under the existing creation rules.
   Fit the record within WorkOS's ten-pair metadata limit: use an explicit
   `authority_accepted_at` timestamp and the canonical agreement hash in the v2
   record. The provider organization ID and reserved external ID bind its identity.
   Preserve readable full documents and mobile controls; add no separate consent
   checkbox or invited-member agreement flow.
3. Test the confirmed new-create response before adding first-Admin creation.
   Verify returned identity/organization and active Admin/product access before
   reporting usable success. Reuse the existing recovery boundary for uncertain
   or incomplete outcomes; no grant from an unconfirmed response.
4. Drive the current-membership session switch and guide redirect. On switch
   refusal/outage, keep a safe recoverable result and do not repeat the grant.
   Keep current CSRF, origin, cancellation, bounded admission, and no-cache checks
   green. Recovery/replay combinations continue in S1-03b.

**Homes and anchors.** Start at [signup form](../../src/interfaces/web/auth/workos/workos-signup-form.ts),
[routes](../../src/interfaces/web/auth/workos/workos-signup-routes.ts), and
[adapter](../../src/accounts/providers/workos/workos-signup.ts). Reuse
`test/integration/auth/workos-signup-routes.test.ts`, signup-page cases,
`test/integration/auth/workos-signup.test.ts`, and
`test/acceptance/auth/hosted-workos-signup.test.ts` plus presentation cases.

**Done.** Named, agreed, verified creation produces the confirmed first Admin and
the matching named-organization landing. Legal approval remains a rollout requirement.

#### S1-03b — Creation recovery and eligibility

Implementation and verification status: [S1-03b record](../implementation/admin-s1-03b.md).
The gap below describes the starting point. The record keeps characterization
results, any implementation changes, and the remaining provider and rollout limits.

**Acceptance specification first:**

```gherkin
Scenario Outline: Read recovery state without replaying creation or grants
  Given <saved state>
  When the same subject retries signup after an application restart
  Then <result> without a create, rename, acceptance overwrite, or grant write
  Examples:
    | saved state                              | result                         |
    | organization write succeeded, response lost, no usable membership | support required |
    | membership write succeeded, response lost, current access confirmed | Continue |
    | saved creator record, first Admin revoked | support required               |

Scenario: Keep one organization under concurrent creation
  Given two concurrent creation submissions for one subject with different names
  When both provider results settle
  Then at most one organization persists under the deterministic external ID
  And only a confirmed new-create response authorizes the initial membership attempt

Scenario Outline: Inspect current access and retained creation facts
  Given <state>
  When signup is inspected
  Then <outcome>
  Examples:
    | state                                                | outcome                         |
    | no retained record, past invitation, no current access | normal creation is eligible     |
    | no retained record, current User/Admin product access  | Continue without creation       |
    | valid retained record, usable saved access             | Continue without creation       |
    | broken retained record or lost saved access, no other access | support required          |
    | broken retained record or lost saved access, other current org | support plus Continue there without repair |
```

**Current gap / expected red, not run.** Existing tests already cover several
unknown-write/restart/no-regrant outcomes; keep them green. Extend those outcomes
to named creation and first Admin. A retained older personal-start marker is a
replay barrier, not organization consent or authority to upgrade User to Admin.
A new recovery case may already pass after S1-03a: keep that coverage and make no
gratuitous source change to create a red step.

**Ordered TDD steps:**

1. Characterize existing deterministic-ID, incomplete-create, timeout/conflict,
   restart, and removed-membership cases. Add only missing failing cases for the
   new name/agreement/Admin behavior. Reconcile provider metadata and current
   memberships without replacing saved facts from a later submitted name.
2. Drive parallel requests with different names. Assert one persisted organization
   and no replayed first-Admin grant, not one outbound create request: ordinary
   WorkOS calls have no assumed idempotency-header deduplication. Use the provider
   fake for application recovery and separate provider contract evidence.
3. Add lost-response-before/after-create and before/after-membership cases,
   including late completion, followed by a new application instance. Unknown or
   unusable state stays blocked; fresh trusted reads that confirm usable access can
   recover without grant/rename writes. Never repair revoked or missing membership
   by replaying creation. A failed session switch also grants nothing on retry.
4. Drive eligibility: current product access has no extra Create action/route;
   Admin alone now has product access and continues instead of creating a new
   User workspace. Preserve the S1-02 eligibility update and extend its coverage.
   Former invited members without access can create; retained creator records
   follow saved-start/support recovery after access loss. Test old markers,
   malformed metadata, failed reads, and revoked first Admin without treating any
   as new consent. Keep multiple invited memberships and selection available.

**Homes and anchors.** Reuse [signup recovery](../../src/accounts/providers/workos/workos-signup.ts)
and [signup routes](../../src/interfaces/web/auth/workos/workos-signup-routes.ts),
their unit/integration cases, and
`test/acceptance/auth/hosted-signup-restart.test.ts` with the shared WorkOS fake/site.
Keep future recovery instructions in the existing runbook, with manual review.

**Done.** New cases and retained recovery characterization pass. Saved markers
cannot restore revoked Admin, silently upgrade an old User, or promise every
former creator another organization; other authorized access remains usable.

#### S1-04a — Members and native invitation management

Implementation and verification status: [S1-04a record](../implementation/admin-s1-04a.md).
The acceptance scenarios below define this increment. The record separates local
application evidence from the remaining live provider and cutover checks.

**Acceptance specification first:**

```gherkin
Scenario Outline: Show navigation and Members for the current role
  Given a signed-in <role> in its current organization
  When that person opens the portal and requests Members
  Then <view>
  Examples:
    | role  | view |
    | Admin | Product/Connect, Members, selector, active members, You, and pending expiry |
    | User  | product navigation and no Members access |

Scenario Outline: Send the selected native invitation role
  Given a current Admin in organization A and a valid <role> radio-form submission
  And the recipient has no membership or pending invitation in A
  When the Admin sends an invitation to the entered email
  Then the confirmed pending invitation in A has the entered email and <role>
  And active memberships are unchanged
  Examples:
    | role  |
    | User  |
    | Admin |

Scenario Outline: Manage only current pending invitations
  Given an Admin in A and a current pending invitation in A
  When the Admin submits <action>
  Then the confirmed result is <result> and active memberships are unchanged
  Examples:
    | action | result |
    | resend | resend confirmed, invitation still pending |
    | revoke | invitation revoked |

Scenario: Report an unconfirmed invitation write
  Given an Admin's invitation write has no confirmed provider response
  When Thermus answers the submission
  Then the page states that the outcome is unconfirmed and offers a status check
  And Thermus does not blindly repeat the write
```

**Original gap / observed red.** Before this increment, the portal had no Members
navigation and the account pages kept members and invitation history separate.
S1-01/S1-02 had already removed grant controls and established User/Admin authority.
Shared members lacked the trusted target subject for You and invitations lacked
display expiry. The five new hosted acceptance cases failed on the combined page,
single form, navigation, and unconfirmed-write notice before implementation.
Existing native send/resend/revoke safeguards stay characterized.

**Ordered TDD steps:**

1. Add navigation and Members projection acceptance. Compose Product/Connect,
   Members, and the existing selector for Admin; User gets product navigation.
   Keep Audit logs/Security and Remove/Change role absent. Extend needed directory/view
   facts for trusted You and expiry. Build a bounded complete paginated projection
   of active members and pending invitations. Failed/incomplete reads show safe
   failure, never partial/empty success.
2. Drive the email/User–Admin radio form with User selected by default, escaped
   long values, an empty pending state, and current authorization. Preserve native
   recipient rules and error
   mapping; duplicate pending/member addresses do not become role changes.
   Distinguish member versus pending notices only from confirmed results/current
   reads; otherwise use a neutral conflict notice.
   Forged role/organization/origin/CSRF fields cause no provider write.
3. Drive resend/revoke for pending, expired, accepted, revoked, stale, and foreign
   targets, including state changing after the read. Use explicit native results;
   revoke never means member removal. Pending-only controls follow current state.
4. Inject unknown send/resend/revoke outcomes. Report unconfirmed, reconcile
   before another write, and never blindly retry or invent an invitation ID.
   A pending read does not prove a resend was delivered. Keep tokens/links out of
   pages/logs and preserve bounded work and safe errors. Follow the canonical UI
   rules for forms without JavaScript, labels/focus, long values, and narrow screens.

**Homes and anchors.** Start at [directory](../../src/accounts/organizations/organization-directory.ts),
[overviews](../../src/accounts/organizations/administration-overviews.ts),
[WorkOS adapter](../../src/accounts/providers/workos/workos-organizations.ts), and
[pages](../../src/interfaces/web/account/administration-pages.ts). Reuse invitation
unit cases in `test/unit/organizations/` and `test/unit/auth-workos/`, route cases
in `test/integration/hosted-admin/`, and hosted invitation acceptance cases.

**Done.** Members/send/lifecycle acceptance passes, including read/authorization
errors and unconfirmed writes. Provider acceptance proof remains in S1-04b.

#### S1-04b — Invitation acceptance and trusted landing

**Acceptance specification first:**

```gherkin
Scenario: Open a trusted joined organization
  Given native acceptance with trusted joined context and current membership
  When the Thermus callback completes
  Then the browser opens that organization's MCP guide
  And joining adds no creator agreement, custom activation record, or MCP rebinding

Scenario: Select when joined context is unclear
  Given an AuthKit callback with multiple eligible memberships
  And no explicit application return destination
  And no validated selected or joined organization context
  When the Thermus landing is resolved
  Then the existing workspace selector opens without guessing an organization
```

**Implementation and evidence.** See the [S1-04b record](../implementation/admin-s1-04b.md)
for current results and holds. The first executable case reproduced the gap:
an unselected default sign-in redirected to the root instead of the selector.
Selected current access and explicit safe return paths stayed green. AuthKit
does not supply a distinct invitation marker in the callback contract. Keep an
absent application destination distinct from an explicit one in the sealed
sign-in state. Apply default landing to either ordinary or invitation sign-in;
do not guess which flow occurred. An explicit safe destination, including the
root, keeps its existing behavior and route access checks. Old sealed sign-ins
with a destination remain compatible. Native preservation/race cases are
unproven provider behavior, not claimed failing source tests.

**Ordered TDD steps:**

1. Characterize selected-organization landing and safe ordinary return paths.
   Add the ambiguous default-return case; derive landing only from validated
   provider/session context and fresh membership. Ignore forged organization hints.
2. Drive single/multiple/no-eligible membership and selection refusal/outage
   paths. Reuse the selector and signed-in recovery; preserve unrelated browser
   access, and never infer membership from address/domain alone.
3. Verify readable legal links without an invited-member checkbox/acceptance
   record. Switch browser A→B and reuse the same MCP token for A: it stays bound
   to A. Add no Thermus invitation acceptance endpoint or registry.
4. Prepare and run the exact [native invitation proof cases](#native-invitations--slice-1)
   in the authorized WorkOS verification environment; this can begin early with
   scoped fixtures and needs no Members UI dependency. Cover corporate alternate-address
   active members/opposite roles, overlapping invites accepted by one identity in
   both orders, and acceptance/resend/revoke races. Preserve consumer exact-address
   behavior. Fakes/SDK request tests cannot close this gate; hold if preservation
   is unproven or acceptance can change an active role.
   The [native proof matrix](../testing/workos-invitation-proof-matrix.md)
   gives the exact cases, observations, environment holds, and cleanup scope.

**Homes and anchors.** Use [session callback](../../src/interfaces/web/auth/workos/workos-session-routes.ts),
[organization selection](../../src/interfaces/web/account/account-routes.ts), and
[portal guide](../../src/interfaces/user-portal/portal.ts). Reuse hosted
organization/signup-guidance acceptance, session/selection integration cases,
and `test/acceptance/auth/hosted-live/` with existing WorkOS/browser drivers.

**Done.** Landing/selection acceptance and retained guide cases pass; actual
provider evidence settles the named cases safely without changing ordinary returns.

#### S1-05 — Complete journey, verification, and cutover

Implementation and verification status: [S1-05 record](../implementation/admin-s1-05.md).
The combined offline journey checks the implemented S1-03/S1-04 behavior. Native
invitation proof, real password sign-in and verification/reset, Staging profile
validation, approved organization legal text, and scoped cutover remain holds.
Local doubles cannot close these holds. No provider mutation or cutover is part
of this verification candidate.

The [organization terms proposal](../implementation/admin-s1-05-legal-proposal.md)
contains exact replacement wording for review. It is unapproved and unpublished;
the existing legal bundle and release hold remain in force.

**Acceptance specification:**

```gherkin
Scenario Outline: Create, invite, and join under password authentication
  Given an eligible verified creator and a recipient
  When the creator accepts the approved agreement and creates a named organization
  And the creator invites the recipient as <role>
  And the recipient accepts through WorkOS and selects the joined workspace
  Then the creator has product/MCP and Members access
  And the recipient has <access>
  And the journey has no grant form, MFA gate, or duplicate agreement
  Examples:
    | role  | access                     |
    | Admin | product/MCP and Members    |
    | User  | product/MCP without administration |
```

**Integration evidence.** The combined offline case uses public browser/MCP
interfaces with a local provider fake. It covers named creation, first Admin,
invitation and acceptance for each role, current workspace selection, and
role-specific access. The implementation record owns actual run results. An
already-correct journey is characterization; do not manufacture a failure. If
integration exposes missing source behavior, specify it red in the owning ticket
before its focused TDD fix. S1-04b retains ambiguous-return, selector, and
MCP-binding proof. Native acceptance and real password behavior remain unproven
until the applicable live/manual checks pass.

**Ordered verification and TDD steps:**

1. Compose the acceptance journey through public browser/MCP interfaces and the
   existing site/drivers. Reuse the green ticket cases and add the combined case
   without leaving a failing ordinary test in earlier candidates.
2. Verify the evidence from each owning ticket, including its updated hosted-live
   assumptions, fixtures, assertions, and documents. Prove actual password,
   verification/reset, callback/session, invitation, and selection behavior as
   applicable; fake passes do not replace provider evidence. Keep unavailable live
   checks explicitly unrun, never passed.
3. Complete applicable source gates and manual desktop/mobile/accessibility,
   documents, legal-bundle approval, provider configuration, and $0 checks. Confirm
   onboarding/setup/recovery and portal-design documents are current for Slice 1.
   Resolve the invitation provider gate before approving release.
4. Only after both children of S1-03 and S1-04 and all rollout prerequisites pass,
   execute the [scoped cutover](#clean-internaltest-cutover--execute-at-s1-05):
   close access/writes, end scoped non-password sessions, retire old writers and
   role assignments, bootstrap checked access, and verify fresh password journeys
   before reopening. On failure keep access/writes closed; never restore unsafe
   writers against the new role model.

**Homes and anchors.** Keep the combined case under `test/acceptance/auth/` using
`test/support/dsl/`, browser/MCP drivers, and the existing hosted site. Extend
applicable `hosted-live` cases through their dedicated command. The canonical
cutover and verification sections own manual procedures; add no document/config
tests or new test framework.

**Done.** The combined acceptance journey is green, both grouped tickets are
complete, legal/provider/manual evidence and applicable gates pass, and scoped
cutover verifies before reopening. Release only Slice 1.

### Slice 2 — Collector settings and export

The [audit log rules](#audit-logs--slice-2), [storage
rules](#selected-supabase-postgresql), and [owner setup](#owner-setup-for-supabase--slice-2)
remain the specification. These tickets split their implementation, not their guarantees.
S2-01 means both S2-01a/b; S2-02 means both S2-02a/b; S2-03 means S2-03a/b/c wherever
another slice names a group. All groups have implementation candidates and
linked records below. S2-04 adds integrated controlled proof, visible help, and
owner procedures. The combined candidate is not released. The review below
owns code-merge work; the [S2-04 ledger](../implementation/admin-s2-04.md#evidence-and-release-holds)
owns actual storage, Collector, notice, capacity, and Slice 1 release proof.
Settings backup, key recovery, and restore are future Slice 4 work.

#### Slice 2 review and remaining work

Reviewed source: `751c704063a153fba1b553c06369a3d72fe8a19d`, against main
`b03e2d2c1ae55eed1d31e808e9a2dd65a6483220`, on 24 October 2026.
The review checked all nine PRs and the combined source. It found one required
source correction. It found no further material defect in the reviewed storage,
authority, System/Audit separation, snapshots, or delivery paths. This is a
review conclusion within that scope, not proof that no other defect exists.

| Finding | Required action | State |
|---|---|---|
| P2: URL credential redaction consumes adjacent public content. A JSON result with `?token=PRIVATE` followed by a public sibling field loses that field; a Markdown link can lose its closing text. | Complete the [S2-03a correction](#s2-03a-correction--preserve-public-text-around-redacted-urls) in the final integration candidate. | Corrected in #245 after failing acceptance and unit cases. Complete quoted values, ordinary Markdown links and autolinks retain their boundaries; unsupported text keeps conservative redaction. The focused and affected audit groups pass; final gates are recorded with the PR. |
| #237 conflicts with current main in `.pr-impact.json` and the base metrics record. | Use the complete #245 candidate as the merge target. PR240 already merged main and kept main's immutable metrics record. | The 24 October graph check confirms that main and all nine PR heads are ancestors of #245. Its merge is clean; no separate #237 repair is needed. |
| #238 conflicts with the newer #239, but #241 includes its exact head `e64a49c6` through merge `c31f499f`. | Preserve that join in #245. After integration, verify #238 is marked merged through #245 and retain its evidence. | No separate repair, rebase, or duplicate settings implementation is needed. |
| Required checks and review must cover the complete merge candidate. | Refresh local gates, quality and architecture evidence after the correction, and record independent authorized human T2 approval for the final head. | The owner reports architect approval of the reviewed stack. Main has no required GitHub status checks and the repository has no CI workflows; the denied status endpoint does not establish a missing required check. Local gates remain required. |
| Some ticket prose still described Test/delivery as future work or checks as never run. | Use combined-candidate status here and preserve historical ticket records as history. | Corrected in this review update. |

The dependency history is **#237 → #239 → #240 → #241 → #242 → #243 →
#244 → #245**, with **#238 included by #241**. Deliver the complete stack by
merging #245 into main with a merge commit. Preserve the ancestor heads and the
#238 side parent. Recheck ancestry and current refs, then reconcile the included
PRs as indirectly merged. Do not squash away the reviewed history or merge a
broken intermediate candidate merely to close a PR. PR #245 remains Draft until
its correction and required local checks are complete.

The redaction correction is part of #245. Refresh its complete-candidate checks
and required review before the single stack merge. Complete the linked S2-04 ledger
before activation. Its live setup and owner obligations do not add code-merge
prerequisites while the feature stays inactive.
Absent server settings leave storage/export unavailable. The new-settings form
defaults to disabled; an Admin can explicitly enable on the first Save. Existing
saved enabled state persists across deployment. Merging code does not authorize
setting secrets, deployment, or enabling export. A previous live observation
recorded Render auto-deploy as off; recheck deployment settings before a merge.
The owner moved backup cadence, retention, custody, key recovery, and restore to
Slice 4. Slice 2 runs without settings backups; the existing procedure is future
reference and adds no S2 prerequisite.

**Simplicity decisions retained by this review:**

| Part | Smallest correct scope |
|---|---|
| Settings and UI | One settings row per tenant, one Save, one optional saved Test; no draft copy, connection history, or viewer. |
| Storage and secrets | Existing plain PostgreSQL port and encrypted Bearer token; no ORM, identity mirror, event database, or automatic key rotation. |
| Customer capture | Explicit Audit methods and named fields; fix the URL redaction boundary within this owner, without a general document parser or System logger rewrite. |
| Delivery | Keep the bounded snapshot, queue, and sender owners. Their different freshness, revision, and native-cleanup rules are needed for safe nonblocking export. Add no durable queue, worker, polling service, or second pre-send read. |
| Verification | Keep existing failure cases plus focused regression cases. The integrated journey composes them; it need not repeat every failure matrix. |
| Operations | Keep one release ledger and the existing scoped runbooks. Member removal stays in Slice 2.5; role changes and MFA stay in Slice 3. |

#### Slice 2 ticket map

| ID | Depends on | Deliverable | Done |
|---|---|---|---|
| S2-01a | Merged Slice 1 identity/account implementation | Private settings store, bounded SQL runtime, and configuration. | Atomic tenant/revision contract and storage failure/lifecycle cases pass. |
| S2-01b | S2-01a, S1-02, S1-04a | Current-Admin destination settings, encrypted credential, and Save UI. | Save, secret, authorization, and uncertain-result cases pass. |
| S2-02a | Audit API foundation and existing runtime contracts | Narrow safe OTLP/HTTP JSON sender. | Actual-connection egress and bounded protocol outcomes pass. |
| S2-02b | S2-01b, S2-02a | Save the current form, then optionally Test that saved destination. | Save-before-Test, failed Save, saved-revision, disabled Test, and late-result cases pass. |
| S2-03a | S2-01b | Safe customer events and operator-content removal. | Final public content and shipped admin events have correct isolation and byte bounds. |
| S2-03b | S2-01a, S2-03a | Activity-driven settings snapshots and bounded pending capture. | First event after startup/expiry, remote Enable, read recovery, bounded retention, and no idle reads pass. |
| S2-03c | S2-02a, S2-02b, S2-03b | Bounded queue, current-revision dispatch, and retries. | Isolation, overload, outage, retry, and shutdown cases pass. |
| S2-04 | Implemented S2-01/02/03 and configured Slice 1 implementation | Integrated verification, owner rollout, documents, and release. | Full Slice 2 journey and actual storage/Collector/manual/legal/$0 proof pass. |

The original recommended implementation order was **01a → 01b → 02a → 02b → 03a → 03b → 03c → 04**.
The dependency table allows 02a independently of the settings store; the actual
PR delivery path is recorded above. The existing Slice 1 source is the
functional starting point; S1-05 release and cutover remain a hard gate for Slice 2 release,
not a claim that merged code was released. Tickets are behavior increments, not
requirements for eight packages, classes, or pull requests.

**Execution rule for these tickets.** Begin each implementation ticket with its acceptance
specification through public interfaces. Run it and record the missing behavior that makes
it red. Then take one focused red → minimal green → refactor step at a time; run that test
and keep earlier cases green. End with the acceptance case green in the same candidate. Use
passing characterization for behavior that already works; never invent a red by breaking it.
Do not leave long-lived failing ordinary tests, skips, or a new framework for later tickets.
Select complete-candidate gates after the final change under the repository policy. Choose
and document fixed numeric bounds in the ticket that owns them, then test the boundaries;
add no customer numeric controls. Unit tests run only their own production package with
other packages doubled at public interfaces. Interface tests check one public contract; real
collaboration across packages is integration. DSL, drivers, sites, and external-system
doubles use the existing `test/support` layout. Reviewed configuration, SQL setup,
documents, and manual rollout proofs need no tests of file text or prose.

#### S2-01a — Durable private settings store and bounded runtime

**Implementation record.** S2-01a adds the server store contract, plain `pg`
adapter, bounded runtime, hosted configuration/lifecycle integration, and reviewed
scoped schema/role setup for destination settings only. It adds no audit event
writer, event table, or durable export buffer. See
[scope and verification limits](../implementation/admin-s2-01a.md).
S2-01b in PR #238 adds the Admin settings page and Save. S2-02a/b and
S2-03a/b/c candidates add the sender, Test, capture, snapshots, and delivery;
see their implementation records below. Actual Supabase setup and
TLS/grant/persistence/$0 proof remain S2-04 owner gates. Backup/restore proof is
deferred to Slice 4 by the owner’s 24 October scope decision.

**Acceptance specification first:**

```gherkin
Scenario: Keep tenant settings across runtime restart
  Given a hosted runtime with the scoped SQL store configured
  When a settings change is saved for organization A and the runtime is reopened
  Then A has the committed settings and revision and organization B is unchanged

Scenario: Keep product access during storage failure
  Given current WorkOS access and a real SQL connection or query that stalls
  When settings are read through the new public store contract while a client calls MCP
  Then the storage call returns within its deadline and MCP remains usable
  And late database work remains bounded and is disposed
```

**Initial gap / expected red.** Before S2-01a, there was no private SQL settings
store or runtime database configuration. The acceptance and focused tests were
written against that gap. Existing MCP, WorkOS access, and shutdown behavior
provide characterization. The implementation record above identifies the current
scope; its review evidence records observed checks. Store acceptance uses the
public contract; browser Save acceptance arrives in 01b.

**Ordered TDD steps:**

1. Red: focused runtime-configuration cases cover absent/partial values, PostgreSQL URI
   validation, the independent base64 32-byte encryption key, and optional CA path. Green: add
   the narrow settings reader and an explicit unavailable state that disables storage/export
   without breaking MCP or admitted product access. Reject conflicting URL SSL options,
   including `ssl`, `sslmode`, `sslrootcert`, `sslcert`, and `sslkey`; configure certificate
   and hostname verification explicitly. Refactor diagnostics to expose variable names, never
   values.
2. Red: interface cases specify tenant-scoped read and atomic expected-revision Save,
   including absence, concurrent first saves, stale writes, and disable→enable. The
   destination owner supplies semantic no-op decisions; the store checks revision atomically.
   Green: implement plain `pg` SQL for endpoint, auth, enabled state, encrypted
   credential, and revision only, with one atomic statement per Save and one
   revision per actual change.
   Refactor to a portable narrow contract; no Supabase SDK, ORM, general repository, or second
   adapter. Store/portal contracts expose no WorkOS or Supabase SDK types. Domain credential
   decisions and encryption belong to 01b; the store persists their opaque value.
3. Red: storage-owner cases stall acquisition and queries, exceed admitted and pending
   capacity, and inject idle disconnects. Include late acquisition/query settlement after
   caller timeout and verify accounting and disposal. Green: bound admission, pending work,
   acquisition, query duration, and error handling. Keep actual work accounted until disposal,
   release/destroy late clients, and ignore late caller results.
   Refactor with these cases green; a pool maximum alone does not establish the bounds.
4. Red: integration cases compose the real runtime/store and verify failure does not block MCP
   or trigger health-check restarts. Green: own the pool in the existing app lifecycle and
   close it within the shared 10-second shutdown deadline, including stalled work. Refactor
   without a new lifecycle framework.
5. Run real scoped PostgreSQL integration for persistence, competing saves, and tenant
   isolation. Prepare reviewed schema/role setup and `.env.example` placeholders in
   owner-setup order. Review migrations/configuration manually; source runtime behavior is the
   test subject. Do not use privileged runtime credentials, mutate unrelated data, or treat
   local SQL as actual rollout proof.

**Homes and anchors.** Existing composition is
[`hosted-workos-application.ts`](../../src/app/hosted-workos-application.ts) and
[`application.ts`](../../src/app/application.ts); configuration starts at
[`deployment-config.ts`](../../src/runtime/config/deployment-config.ts). `src/index.ts` owns
the existing shutdown deadline. The destination settings contract, SQL adapter, and bounded
runtime now live in `src/logs/audit/`; the settings reader is
`src/runtime/config/logging-storage-config.ts`, composed by `src/app/logging-storage.ts`.
The initial characterization anchors are `test/unit/config/deployment-config.test.ts`,
`test/unit/application-lifecycle.test.ts`, and
`test/acceptance/mcp/hosted-process-shutdown.test.ts` for characterization. Add focused
store contract cases under `test/interface/`, real SQL collaboration under
`test/integration/`, and the new public acceptance under `test/acceptance/`.

**Done.** Atomic scoped storage and bounded runtime acceptance pass. Reviewed setup uses the
selected existing project, private schema, and restricted runtime role. The app needs no
Supabase API keys. Actual TLS/grant/persistence/$0 rollout proof is retained for 04;
backup/restore proof is deferred to Slice 4. Source/configuration completion does
not pass that gate.

#### S2-01b — Admin settings, encrypted credential, and atomic Save

**Implementation status.** [PR #238](https://github.com/tomer-mayara/Thermus/pull/238)
implements this ticket; reviewed source is
[`e64a49c6`](https://github.com/tomer-mayara/Thermus/tree/e64a49c6cdbc6f5d7a47d2bfc0fd61907e3dca81).
The [native page and route](https://github.com/tomer-mayara/Thermus/blob/e64a49c6cdbc6f5d7a47d2bfc0fd61907e3dca81/src/interfaces/web/account/logging-routes.ts)
read and save through the tenant-bound settings service and PostgreSQL store.
Current Admin access, origin/CSRF, token encryption/no echo, organization isolation,
and revision conflicts have source acceptance coverage. The
[implementation record](https://github.com/tomer-mayara/Thermus/blob/e64a49c6cdbc6f5d7a47d2bfc0fd61907e3dca81/docs/implementation/admin-s2-01b.md)
records checks and limits. This implementation record does not establish current
merge status, deployed access, or customer delivery. The S2-02b candidate adds Test; S2-03 adds capture and dispatch.

**Current form update.** The [Audit logs UI](#audit-logs-ui--slice-2) now requires
an explicit Axiom or Custom choice. Axiom requires its dataset; both choices
use Bearer authentication. The original TDD record below includes None support
at the settings-service boundary. That support remains for stored settings and
the sender; it is no longer a choice in the Admin form. The current form has the
short authority/privacy warning, rather than the original long explanation.

**Acceptance specification first:**

```gherkin
Scenario: Save one protected destination
  Given a password-authenticated current Admin in organization A
  When the Admin saves endpoint, Bearer token, and Enable together
  Then rereading A shows that saved version and token presence without the token
  And another tenant or stale form cannot change it

Scenario: Show an uncertain Save honestly
  Given a Save whose SQL commit result is unknown
  When the browser receives the outcome
  Then it shows an unconfirmed result with only a saved-state read link and no Save form
  And it neither claims nothing changed nor blindly repeats the Save
```

**Initial gap / expected red.** Audit logs settings, encrypted credentials, and their
native page did not exist before S2-01b. Save and protected reread were the initial
red specifications. Keep current password, Admin permission,
selected-org, origin/CSRF, escaping, and no-cache outcomes green. Do not require MFA or the
later membership-reduction coordinator.

**Ordered TDD steps:**

1. Red: destination-owner unit cases cover one public HTTPS endpoint, None/Bearer, initial
   disabled state, and all-or-nothing validation. Green: validate the settings operation and
   call 01a's atomic Save. Keep endpoint syntax checks distinct from 02a's actual-connection
   security. Refactor with no draft/active copy and no duplicated revision owner.
2. Red: credential cases cover replacement, None clearing, and blank Bearer. Green: retain a
   blank token only for unchanged endpoint/auth; changed endpoint with Bearer needs a new
   token. Encrypt server-side with the external key and authenticate tenant binding so a
   copied ciphertext cannot serve another tenant. Refactor the public read projection to token
   presence only. Check wrong key, altered ciphertext, and tenant mismatch fail closed without
   secret diagnostics.
3. Red: public operation cases cover stale/no-op/concurrent Save, re-entering the same
   token, and an uncertain commit. Include a timed-out Save that commits after the first
   reload and a later competing expected-revision Save. Green: keep the revision when the
   token and other settings are unchanged; randomized encryption alone must not create a
   settings change. Preserve 01a's atomic revision/write contract and preserve existing
   ciphertext on a semantic no-op. Distinguish definite refusal from unconfirmed outcome and
   require a saved-state reload before the native page offers another Save form. Manually
   submitted old forms still face atomic revision checks; no server write hold is needed.
   A stale write must not overwrite the newer commit.
   Do not add automatic write retry, a second settings history, or a member-operation log.
   Refactor errors without echoing endpoint credentials, tokens, or SQL values.
4. Red: web-boundary cases submit valid and forged forms, changed current roles, and tenant A
   requests naming B. Green: derive authority from current trusted context and current Admin
   permission, retain password access, check origin/CSRF, and reject stale revisions. Reuse
   the existing neutral User/Admin access boundary; add no WorkOS permission/catalog change
   for Audit logs. Use a double for a cross-package collaborator in unit cases; use integration
   for real web/settings/account collaboration.
5. Red: browser acceptance saves and rereads the new page. Green: add native None/ Bearer
   radios, write-only Token, saved-token presence, Enable, Save, and Audit logs navigation for
   Admins. Preserve root/nested paths, escaping, cookies, no-cache, and safe errors. Refactor
   only after secret absence and atomic Save cases pass.

**Homes and anchors.** Existing web owners are
[`account-routes.ts`](../../src/interfaces/web/account/account-routes.ts),
[`administration-routes.ts`](../../src/interfaces/web/account/administration-routes.ts), and
[`account-form.ts`](../../src/interfaces/web/account/account-form.ts). Current membership
checks start at
[`organization-administration.ts`](../../src/accounts/organizations/organization-administration.ts).
Navigation exists in `src/interfaces/user-portal/portal.ts` and
`src/interfaces/web/account/members-page-layout.ts`. The destination service, credential
codec, and Audit logs page are implemented in the linked S2-01b candidate. Reuse
`test/integration/hosted-admin/` form/change patterns and
`test/acceptance/auth/hosted-admin-journey.test.ts` browser/site patterns. Place focused new
destination unit tests with that package, not in WorkOS tests.

**Done.** Current Admins can save and read only their tenant's settings; all Save, revision,
token, and unconfirmed-result cases pass. No credential reaches HTML, frontend
configuration, operator logs, or responses. This ticket does not send a Collector request;
Test arrives in 02b.

#### S2-02a — Narrow safe OTLP/HTTP JSON sender

**Acceptance specification first:**

```gherkin
Scenario: Send one safe Collector request
  Given a validated public HTTPS destination and None or Bearer auth supplied to the sender
  When one projected audit event is submitted to the sender
  Then the Collector receives valid OTLP/HTTP JSON with only the supplied auth
  And the caller gets the bounded protocol outcome

Scenario: Refuse an unsafe actual connection
  Given a destination that resolves or changes to a private address
  When the sender connects
  Then no event or credential is sent to that address or a redirect target
```

**Candidate status.** The [S2-02a implementation record](../implementation/admin-s2-02a.md)
and [PR #240](https://github.com/tomer-mayara/Thermus/pull/240) describe the
isolated sender, its fixed bounds, and its evidence limits. The PR is based on
the Audit API foundation in #239 and does not depend on the Save UI in #238. It
does not establish production capture, queued dispatch, or release readiness.
The actual endpoint smoke and live Supabase checks remain later release gates.

**Original gap / expected red.** The internal OTel system adapter does not supply this audit sender,
actual-connection policy, or complete response interpretation. The new sender
acceptance specification failed before implementation.
Existing system logging remains characterization; local HTTP receiver passes do not prove
production public-HTTPS egress.

**Ordered TDD steps:**

1. Red: one sender-interface contract specifies full acceptance, warning with zero rejected
   records, partial rejection, permanent failure, transient failure, and unconfirmed outcome.
   Green: map the neutral audit event contract to OTLP/HTTP JSON through a narrow
   one-shot public sender interface taking supplied destination/auth and returning typed
   results. Keep OTLP encoding out of capture and projection. The sender does not load
   settings or encrypted credentials; 02b/03c own that collaboration. Refactor without
   callbacks that hide partial acceptance.
2. Red: focused sender cases exercise public HTTPS, allowed paths, forbidden
   userinfo/fragments/all queries, private/loopback/metadata IPs, IPv6, DNS changes, and
   redirects. Green: validate DNS/IP before connection and ensure the socket uses a
   validated address with TLS hostname verification; revalidate each new connection. Follow
   zero redirects and permit no connection-time DNS bypass. Refactor policy where every
   connection passes it. Website DNS preflight alone is insufficient.
3. Red: protocol cases inspect POST, `application/json`, lowerCamelCase fields, decimal-string
   64-bit event and observed timestamps from the same captured time, None/Bearer, and request/payload limits,
   timeout/cancellation, response size/parse limits, and sanitized errors. Green: implement
   those bounds and isolate customer TLS/headers from system OTel environment defaults.
   Refactor with distinctive platform headers/tokens proving they never merge into a customer
   request. Bound connection/agent resources without per-tenant exporter pools.
4. Red: response cases cover HTTP 200 with matching JSON content type and valid `{}`,
   HTTP 200 with malformed success JSON, HTTP 500 with `{}`, HTTP 503 with bounded
   malformed/HTML error bodies, warnings/partial rejection, oversized bodies, and bounded
   `Retry-After` seconds/date values. Green: apply the canonical status/content rules and
   return typed outcomes. Malformed success/oversized responses cannot confirm acceptance
   and are nonretryable; bounded error-body syntax must not override retryable HTTP status.
   Refactor without raw bodies/auth in diagnostics or a retry loop: 03c owns delay/jitter,
   attempts, and item lifetime.
5. Verify None/Bearer OTLP/HTTP JSON with a separate minimal offline receiver and an
   open-source Collector through a controlled transport seam where needed. The existing
   fixture also starts Axiom output. Local protocol/caller integration is not production
   egress proof. Separately run the unchanged connected-address/TLS guard with a controlled
   public-address network/TLS fixture or equivalent permitted endpoint, plus an actual
   endpoint smoke check before release. Add no allow-private/test bypass or paid receiver.

**Homes and anchors.** The customer sender belongs to the existing audit owner in `src/logs/audit/`, separate from
[`otel-system-log-sink.ts`](../../src/logs/system/otel-system-log-sink.ts). Inspect
[`network-policy.ts`](../../src/pipelines/providers/website-fetcher/network-policy.ts) for
existing DNS preflight, not proof of connected-address safety. Existing
`test/interface/logging/system/otel-logger.test.ts` and
`test/support/doubles/logging/otel-log-receiver.ts` show receiver patterns;
`createOtlpFixture` also configures live Axiom export and is not an isolated
production-egress fixture. The candidate keeps focused wire-format and sender cases
under `test/unit/logging/audit/`, because their real source collaborators share one
owner. Real sender/Collector collaboration is under `test/integration/logging/audit/`.
Separate interface tests are not needed to repeat the same wire cases.

**Done for the original S2-02a increment.** One-shot protocol and actual-connection
security acceptance pass with None/Bearer evidence and fixed bounds. That increment
promised no direct Axiom/Grafana support. The owner’s 24 October rollout addition
now permits the narrow Axiom dataset routing header described above. It adds no
universal receiver, arbitrary custom headers, client certificates, or alternate
transport promise.

#### S2-02b — Save settings and optionally Test the saved destination

**Acceptance specification first:**

```gherkin
Scenario: Save edits and Test a destination
  Given a current Admin with valid edits to the destination and export switch
  When the Admin selects Test
  Then the form is saved before a Test event is sent
  And one labelled synthetic event uses the confirmed saved version and its auth
  And the result appears in the Audit settings page
  And a disabled export switch stays disabled

Scenario: Save cannot be confirmed
  Given valid destination edits whose Save fails or has an uncertain outcome
  When the Admin selects Test
  Then no Test event is sent
  And the Audit settings layout shows a safe error
  And an uncertain Save offers a saved-state read link without a write form

Scenario: Ignore an old Test result
  Given a Test in progress for a saved revision
  When the post-settlement saved-revision read differs or fails
  Then the response suppresses the obsolete or unconfirmed result
```

**Candidate implementation.** [PR #241](https://github.com/tomer-mayara/Thermus/pull/241)
is stacked over #240 and includes the settings dependency from #238, merged
into this branch.
The [implementation record](../implementation/admin-s2-02b.md) describes the
original saved-only Test, bounded lifetime, and result suppression. PR #250 adds
the save-before-test web flow above without changing that service operation. Its linked PR evidence
records local checks and technical review; current merge requirements are listed
above. This is not a release record. The steps below
preserve the acceptance and implementation order. A successful Test is never
an Enable prerequisite.

**Ordered TDD steps:**

1. Red: destination-operation cases require current Admin authority, the submitted saved
   revision, and a labelled synthetic record. Green: one fresh read of a full saved version
   supplies revision, enabled state, endpoint, and credential for the pre-send decision.
   Recover the credential through the destination owner and call 02a once, allowing the
   explicit disabled-state exception. Keep the service Test operation separate from
   Save; it must not use unsaved values or change the export switch.
2. Red: concurrent/repeated tests exceed admission, or a read fails/changes revision before
   send. Green: bound Test work and use that single fresh saved-version read immediately
   before the attempt; stop on failed reads or mismatch. Do not load settings and then issue
   another pre-send read or mix versions. Reuse the sender's security, timeout, payload/response,
   and cancellation bounds. Keep Test one-shot; no nested retries. 03c later proves the shared
   aggregate delivery bounds.
3. Red: web cases cover CSRF/origin refusal, Save-before-Test, failed or uncertain
   Save, cancellation after Save, each typed sender outcome, and a late result
   after a revision change. Green: save the submitted form, then test only the
   returned saved revision with a blank token input. A mismatch or failed post-read
   suppresses the sender result. Show safe results within the Audit settings page;
   distinguish a saved configuration from a failed Test and preserve uncertain-Save
   recovery. Refactor without result history, polling dashboard, or enable gate.
4. Run browser/settings/sender integration for None/Bearer and disabled Test. A controlled
   transport seam may reach a local Collector to verify protocol and synthetic labels; it
   does not prove production egress. Retain 02a's separate unchanged-guard address/TLS proof;
   add no allow-private/test bypass.

**Homes and anchors.** The candidate extends the S2-01b destination service and
Audit logs page with S2-02a's public sender contract. Existing route/form cases under
`test/integration/hosted-admin/` supply security patterns. Use destination-package unit
tests, a small Test contract where needed, and public browser acceptance under
`test/acceptance/`; shared sites/drivers belong under `test/support`.

**Done for the original increment.** Saved-only, disabled, bounded, and late-result
Test acceptance passed. The current follow-up adds Save-before-Test at the web
boundary and inline results. Its complete validation is recorded in PR #250.
Test remains optional and proves neither continued delivery nor durable storage.

#### S2-03a — Customer capture and operator-content isolation

**Acceptance specification first:**

```gherkin
Scenario Outline: Capture only final public tool content for the trusted tenant
  Given enabled settings and distinctive valid tool input in organization A
  When the tool produces <outcome>
  Then one customer event describes the validated input and final public outcome
  And tool content reaches neither operator diagnostics nor another tenant

  Examples:
    | outcome       |
    | success       |
    | empty success |
    | safe error    |
    | cancelled     |
    | withheld      |

Scenario: Preserve a completed administration action when capture fails
  Given a current Admin and a customer sink that throws or refuses work
  When a shipped invitation or Audit logs action completes
  Then its public outcome stays complete and the action is not replayed
```

**Gap / expected red at the parent.** The audit API foundation exists, but production customer
completion capture is absent. Existing account change records still use the
internal system output and do not establish a customer audit stream. Fetch completion records at the parent
expose URL origin/path and reason; the privacy case should be red there. Search
already omits content from operator completion output and must stay green.
`ChangeRecorder.record()`, invoked by `ChangeRecording.keep()`, can currently throw
after a completed write; its new sink-failure behavior needs a focused red, not a
blanket logger rewrite.

**Ordered TDD steps:**

1. Red: MCP-boundary cases cover validated fetch/search input and final projected public text
   after safe error/cancellation mapping. Green: emit one customer completion event from the
   public boundary with trusted tenant/actor/operation. Preserve withheld and empty results.
   Refactor without capturing invalid argument objects, unknown tools, `_meta`, raw
   exceptions, or intermediate HTML.
2. Red: event-owner cases exercise known credential fields and recognized credential-bearing
   URL parameters. Green: redact them from exported input/result copies and diagnostics.
   Refactor with no promise that arbitrary free text is secret-free; never inspect or export
   cookies, auth headers, or sign-in forms.
3. Red: maximum valid fetch/search inputs, JSON escaping, and multibyte results exceed fixed
   result and serialized-event UTF-8 byte budgets. Green: reserve input/metadata space first,
   truncate only the exported result at Unicode boundaries, and include original and captured
   result UTF-8 byte sizes and an explicit marker. Refactor without changing product input
   contracts, truncating client results, or adding chunks/general serialization.
4. Red: distinctive fetch content appears in operator completion output. Green: retain stable
   operation/tool/status/duration and opaque identity metadata while removing
   URL/query/reason/result. Keep existing search privacy green. Refactor and verify
   Render/operator/export-error paths contain none of that content.
5. Red: shipped invitation send/resend/revoke and Audit logs actions capture metadata with
   independently trusted org/actor context; denied A naming B must not route to B. Green: add
   those events only. Unattributable attempts stay in sanitized operator diagnostics. Refactor
   without adding future removal/MFA or global personal-factor/support events. Exclude
   sender responses, retry work, and settings-read diagnostics from capture to prevent
   recursion. One Audit logs action may yield one admin event; its synthetic Test is separate.
6. Red: sink throw, full admission, and failed post-write recording affect a completed action
   or tool result. Green: make customer capture/enqueue bounded and non-throwing and isolate
   it from synchronous post-write `ChangeRecording` failures. Refactor while proving no
   completed provider write is retried and no raw exception or tool content appears in
   feedback about export failure.

**Homes and anchors.** Start at
[`fetch-tool-server.ts`](../../src/interfaces/mcp/fetch-tool-server.ts),
[`tool-completion-record.ts`](../../src/interfaces/mcp/tool-completion-record.ts),
[`change-records.ts`](../../src/accounts/organizations/change-records.ts), and
`src/app/application.ts` record composition. The event-specific `AuditLog` API foundation lives in
`src/logs/audit/`. S2-03a extends the parent metadata-only `toolCompleted`
contract with redacted, bounded input and result and wires runtime capture through
a supplied sink. Event projection and sink wiring do not establish delivery;
the default sink drops events until S2-03b/c supplies snapshots and dispatch. Reuse `test/unit/mcp/tool-completion-record.test.ts`,
`test/integration/mcp/tool-completion-record.test.ts`,
`test/integration/mcp/fetch-tool-server.test.ts`, and organization-change cases. Real
MCP/audit or organization/audit collaboration is integration; acceptance checks
observable customer versus operator outputs through shared support drivers.

**Implementation candidate.** The [S2-03a record](../implementation/admin-s2-03a.md)
describes the supplied capture sink, trusted boundary context, fixed byte bounds,
and completion isolation. In that historical increment the default sink drops
events; the combined candidate uses 03b/c snapshots and dispatch. Recorded runs
of the existing specifications passed, but the review found the redaction gap
below. Controlled-sink evidence alone does not establish snapshot loading or delivery.

##### S2-03a correction — Preserve public text around redacted URLs

This is a correction to S2-03a, not a new export feature or a separate slice.
The earlier URL-value expression in `src/logs/audit/audit-content.ts` consumed closing
JSON/Markdown syntax and unrelated public text after a recognized credential.
The following missing case failed before the correction:

```gherkin
Scenario: Redact a URL credential without deleting surrounding public output
  Given an enabled tenant and validated input and a result with token=PRIVATE in a URL
  And the URL is enclosed in JSON or Markdown followed by KEEP_PUBLIC
  When the public completion is captured for Audit delivery
  Then PRIVATE is absent from the exported input and result
  And KEEP_PUBLIC and the unambiguous enclosing syntax are preserved
  And the client receives its original complete result
  And the small exported result has correct byte counts and truncated=false
```

BDD/TDD record:

1. Add the failing public-boundary acceptance case above. Use the existing
   MCP/audit driver; do not add a test framework or duplicate the full journey.
2. Add focused failing capture/encoding cases for a JSON sibling field and a
   Markdown link with adjacent public text. Keep encoded parameter names,
   quoted/escaped credential values, Unicode, and result-boundary cases green.
3. Correct the bounded redaction rule in its existing owner. An accepted URL
   can contain quote or angle-bracket characters in its credential value: merely
   treating every such character as a delimiter can expose the credential tail.
   Preserve public text only with a known enclosing boundary; keep ambiguous
   credential text redacted. Add no general serializer or per-tenant setting.
4. Refactor with the focused tests green, then rerun the acceptance and selected
   complete-candidate gates. Retain the new red/green evidence and refresh the
   affected PR review.

The final #245 correction follows this sequence. Its acceptance case checks exact
public JSON/Markdown output, credential removal, and byte counts through
`AuditLog`. Focused unit cases cover query, reason, result, raw URL punctuation,
escaped and incomplete values, URI keys, and top-level quoted strings. The final
focused run passed 59 cases; the affected audit groups passed 282. The manager
retains red/green logs with the current candidate's separate full-gate evidence.

A validated fetch URL uses the full query-value rule directly. Text recognition
uses complete quoted values, ordinary Markdown destinations with at most one
inner parenthesis level, and autolinks. Unrecognized or incomplete syntax keeps
the conservative full-value rule and can still lose adjacent public syntax.
This is not a general document parser or a promise that arbitrary text is free
of secrets. Escaped quotes cannot start repeated enclosure scans; manual malformed
input checks confirm that the draft's slow scan was removed. Those timing samples
are not a latency guarantee.

#### S2-03b — Activity-driven settings snapshots

**25 October correction.** The original S2-03b candidate discarded the event that
started a settings load. That rule loses the first event after startup and after
the 30-second freshness period. The following acceptance criteria and steps
supersede that rule; the linked original PR remains historical evidence.

**Acceptance specification first:**

```gherkin
Scenario: Capture the first event without waiting in the product path
  Given enabled saved settings and a new runtime or expired snapshot
  When the first trusted-tenant tool or Admin action completes
  Then its response returns without waiting for settings or export
  And its bounded audit event waits for one settings load
  And a current enabled result admits that event once under the observed revision

Scenario: Discard unresolved content safely
  Given audit events waiting for one settings load
  When the result is disabled, absent, invalid, failed, or too late, or the owner closes
  Then all waiting content is discarded
  And a later Enable or successful load cannot revive that content

Scenario: Keep pending capture bounded
  Given an active metadata read and events for its organization
  When more events arrive before that read settles
  Then admitted events keep their arrival order and share its original deadline
  And events beyond the count or byte limit are refused without delaying product work
```

**Gap / expected red at the follow-up base.** The original owner intentionally
loses the first event. New startup/restart and freshness-expiry acceptance cases
must fail before the correction. Capture projection, product response isolation,
and collector revision checks remain green.

**Ordered TDD steps:**

1. Red: cold and expired enabled settings lose the first bounded event. Green:
   retain a detached, frozen copy during one settings load and bind it once to
   that read's enabled revision. Refactor within the existing snapshot owner;
   no synchronous SQL wait or separate worker is needed.
2. Red: concurrent events exceed pending count/byte limits, mutate retained
   content, reorder, or extend the load deadline. Green: one fixed-deadline batch
   per load, 16 events/1 MiB per batch, 131,072 event bytes, and the existing two
   global load reservations. Notify the collector before FIFO admission. Keep
   snapshot/backoff metadata separate from this temporary content account.
3. Red: disabled, absent, invalid, failed, timed-out, or closed loads retain or
   revive their content. Green: clear each batch permanently; retain only bounded
   failure bookkeeping and unsettled physical-read reservations as required.
   Fresh disabled state drops immediately. Refactor and test later Enable and
   recovery without replay. The read result decides initial admission; document
   the concurrent-Enable observation window instead of an event-time guarantee.
4. Red: late results after deadline, eviction, or shutdown restore capture, or
   uncooperative reads release their slots early. Green: preserve absolute
   deadlines, identity checks, failure backoff, and accounting until physical
   settlement. Pending collector work keeps its separate fresh authorization;
   no old revision is retargeted and no failure changes tool/Admin results.
5. Run real capture/snapshot/store and hosted MCP/Admin collaboration for the
   first event after startup/restart and expiry, query/result preservation,
   remote Enable, failure/recovery, and tenant isolation. Use controlled
   completion signals and clocks. Remove required warm-up requests from the
   integrated Collector journey. Idle time starts no reads.

**Homes and anchors.** Keep the snapshot owner beside customer capture, using the
01a store and 03a sink boundaries. Keep units under audit, real cross-package
collaboration under `test/integration/`, and startup/recovery behavior under
`test/acceptance/`. Existing `test/support/in-process/` sites and
`test/support/doubles/logging/` supply controlled collaborators. Snapshot
freshness is not dispatch authority; 03c owns current store checks.

**Current implementation contract.** The
[S2-03b record](../implementation/admin-s2-03b.md) describes pending capture,
resource bounds, failure behavior, and shutdown. S2-03c supplies dispatch.
The original PR's drop-first-event evidence does not verify this correction;
refresh the affected tests and complete-candidate checks for the follow-up PR.

#### S2-03c — Bounded queue and current-revision dispatch

**Acceptance specification first:**

```gherkin
Scenario: Export a captured event through the audit sink
  Given AuditLog has the bounded Collector sink and enabled saved settings
  When a redacted bounded event is admitted through AuditEventSink
  Then dispatch sends it through the S2-02a sender to the configured Collector
  And it writes no audit event or export buffer to SQL

Scenario: Drop old work after a settings change
  Given queued work for organization A and saved revision R
  When another instance changes A before the fresh attempt-authorization read
  Then dispatch reads the changed settings and drops R before send or retry
  And it never retargets R to the new destination

Scenario: Keep product and shutdown bounded during overload
  Given a slow or failed Collector and a full customer queue
  When tools and Admin actions complete and the app then shuts down
  Then their outcomes remain usable and export stops within the app deadline
```

**Gap / expected red at the S2-03b parent.** There is no customer queue or
revision-aware dispatcher. Overload
and cross-instance change cases should be red. Keep 02a one-shot protocol, 02b saved Test,
and 03a/b capture/loading outcomes green.

**Ordered TDD steps:**

1. Red: sink-contract cases require `writeAuditEvent` to return after bounded memory
   admission without waiting for SQL or network work. Queue-owner cases exceed global/tenant
   item and serialized-byte budgets, active destinations, concurrency, and payload bounds.
   Green: implement the existing `AuditEventSink` seam; one shared item/byte account covers
   queued, settings-read-waiting, in-flight, and retry-backoff content. Drop overload without
   blocking product calls and release accounting once after disposal. Refactor with tenant/
   global bounds and isolation, with no durable queue, worker service, or replay.
2. Red: another store instance changes revision after enqueue or between attempts. Green: when
   work exists, one fresh read of a full saved version supplies revision, enabled state,
   endpoint, and credential immediately before the attempt. Recover the credential through
   the destination owner. This one read authorizes the attempt; do not add another pre-send
   read or mix versions. A later concurrent Save may race it. A cached snapshot cannot authorize
   dispatch. Drop old work on any change, including disable→enable,
   and never retarget it. Refactor short reads with no transaction held across network work
   and no idle polling.
3. Red: settings reads fail or destination changes during a send. Green: stop new dispatch on
   failed reads or observed change, cancel in-flight work when possible, and retain the limit
   that sent data cannot be recalled. Refactor with bounded read work and no tool/admin-path
   wait or product failure.
4. Red: repeated read failures with continued traffic, delayed retries, and sender outcomes
   retain content too long or reset its lifetime. Green: one age deadline from admission
   covers failed reads, attempts, and backoff without reset. This owner alone schedules
   delay/jitter/attempts from 02a's typed retry classification. Honor bounded `Retry-After`;
   drop if its delay exceeds remaining lifetime. Test HTTP 500 versus 503 and bounded
   retention. Refactor without sender/Test retry loops; document loss/duplicates.
5. Red: concurrent Test/export exceed aggregate delivery limits. Green: share applicable
   admission/concurrency/security bounds. Keep 02b's saved-revision checks, ignored late Test
   results, and explicit disabled exception green. Refactor while keeping Test one-shot and
   independent of enabling export.
6. Red: shutdown during acquisition/read/send/backoff retains work past the shared deadline.
   Green: stop admission/dispatch, clear pending memory, cancel bounded work, and close owned
   resources within the existing 10 seconds. Refactor and run composed MCP/admin/SQL/Collector
   outage and shutdown integration. Do not extend the global deadline or make a healthy
   process fail health checks.

**Homes and anchors.** Queue/dispatcher are proposed audit owners in `src/logs/audit/` composed via
`src/app/hosted-workos-application.ts` and `src/app/application.ts`; use `src/index.ts`'s
existing deadline. Supply this sink to `AuditLog`; keep its event contract separate
from the 01a settings port. Build from 01a/02a/03b public contracts, not WorkOS or `pg` internals.
Put queue units under `test/unit/logging/audit/`, real collaboration under
`test/integration/logging/audit/`, and public isolation/overload/shutdown acceptance
under `test/acceptance/logging/audit/`. Reuse existing
process/MCP drivers rather than create a parallel shutdown harness.

**Implementation candidate.** The [S2-03c record](../implementation/admin-s2-03c.md)
describes the implemented bounds, authority, retry rules, observations, and cleanup.
One account covers queued, reading, sending, and backoff content: 128/16 global/tenant
items, 8 MiB/1 MiB serialized envelopes, 131,072-byte events, 32 tenants, and two
active exports with one per tenant. Age is 30 seconds, reads have 2.5 seconds, and
three authorization cycles include temporary read failures and busy outcomes.
Backoff starts at 250 ms, doubles to a two-second base cap, and adds up to 25%
jitter. Retry-After is honored or work is dropped when the remaining age cannot
fit it. A read deadline drops work; an unresolved physical operation keeps its
charged reservation after content is cleared.

Successful current snapshot loads notify existing work of an observed revision;
failed loads do not. Disabled/absent observations cancel all old work, and other
revisions cancel mismatches. This is activity-scoped, with no Save/Test broadcast
or global revision order. Native sender admission (four) and SQL admission (two
active/four pending) are shared by Test and export; their operation limits remain
separate. Product results stay independent of export. Complete-candidate results
and review are recorded in the PR and local review index; source specifications
do not establish a gate pass.

#### S2-04 — Integrated proof, owner rollout, and release

**Development status.** The [S2-04 record](../implementation/admin-s2-04.md) separates
controlled verification and a disposable local recovery drill from actual owner
rollout and release evidence. The [notice review](../implementation/admin-s2-04-notice-review.md)
records Slice 2 disclosure differences; it supplies no new legal approval.
The approved Slice 1 public policies were published. The S2-04 record identifies
a fresh deployed S1 candidate; deployment alone does not close runtime
release/cutover or the [recorded native/mailbox holds](../implementation/admin-s1-staging-release-verification.md).
This candidate does not claim the Done conditions below.

**Acceptance specification first:**

```gherkin
Scenario: Use Audit logs while the product stays available
  Given configured Slice 1 implementation and completed Slice 2 implementation groups
  And a current password-authenticated Admin, reachable supported OTLP destination, and available capacity
  When the Admin saves a disabled destination, Tests it once, and enables it
  And the first eligible MCP action after startup or freshness expiry completes
  And the settings read succeeds with enabled state before its deadline
  Then that action is admitted without a warm-up request
  And the saved tenant receives its bounded input/result and shipped Admin metadata
  And operator output excludes tool content and product outcomes stay independent
```

**Gap / expected red.** The integrated journey may already pass after 01–03. Treat a passing
journey as characterization. Specify only missing product behavior red in its owning ticket
before its focused fix. Legal approval, configuration, actual TLS/isolation,
provider, and cost evidence are manual proofs, not tests of documents. Backup and
restore work is deferred to Slice 4. The
[S2-04 evidence ledger](../implementation/admin-s2-04.md#evidence-and-release-holds)
records which proofs ran and which release holds remain.

**Ordered verification and TDD steps:**

1. Compose the journey through public browser/MCP/Collector interfaces using existing support
   roles. Reference the owning tickets' failure and boundary scenarios rather than duplicate
   their matrices. Integration needs implemented groups and configured Slice 1, not a
   completed Slice 1 release. Fix a discovered source gap red →
   green → refactor in its owner, then rerun the journey. A controlled receiver pass does not
   replace actual supported-destination proof, including direct Axiom for this rollout.
2. Follow ordered owner setup on the selected existing project. Account eligibility is already
   resolved; recheck usage/headroom before rollout, not project selection. Prove actual
   verified TLS/hostname, restricted role/private-schema rights, persistence, and no access to
   unrelated application data. Confirm service-scoped secrets and the required official CA path without
   recording values. Exercise acquisition/query stalls, idle disconnect, pause/quota/reconnect
   behavior, and MCP availability through controlled faults. Do not pause or exhaust the
   shared project; actual live proof is scoped TLS/role/isolation/persistence.
3. Record the owner’s no-backup Slice 2 scope in notice, help, and rollout evidence.
   State the absence of settings backup/restore and audit history/replay. Settings or
   encryption-key loss can require Admin re-entry. Do not require backup selection,
   retention, custody, or a restore drill before Slice 2 release; Slice 4 owns them.
4. Confirm database size/connections/egress and existing Render network headroom under
   realistic bounded load. Keep added ongoing cost $0; no new project, upgrade, trial, paid
   add-on, artificial keepalive, or backup framework. Update deployment, outage/pause/quota,
   reconnect, and key-loss runbooks. Retain restore procedures as future Slice 4 reference.
5. Obtain approved privacy notice and Audit logs help explaining input/result export, recognized
   redaction limits, truncation, best-effort loss/duplicates, and Test's limited meaning.
   Verify native desktop/mobile/accessibility, role navigation, and secret-free errors. Update
   affected setup/portal/operations documents.
6. Run complete-candidate checks, habit-hooks, architecture/registry and quality review,
   review classification, and required approval under repository policy. Retain actual versus
   controlled/live/manual evidence and unrun limits. Release only after the actual S1-05
   release/cutover exit and all Slice 2 gates pass.

**Homes and anchors.** Extend public acceptance under `test/acceptance/` with shared
DSL/browser/MCP/Collector drivers and in-process/process sites under `test/support`. Use
existing hosted-live commands only for applicable provider proof. The canonical owner-setup,
storage, audit log, and release sections own manual obligations; update linked
implementation/runbook/portal documents in the implementation candidates. No tests of
prose/configuration or new general verification framework are needed.

**Done.** All three ticket groups and the integrated journey are green; actual
SQL/TLS/isolation/persistence/$0 and Collector proof, approved notice/help with the
no-backup scope, manual checks, required gates, and approvals are complete. Slice 1 is actually released.
Ship Product/Members/Audit logs only: no member removal, role changes, MFA, Supabase Auth/REST,
identity mirror, or membership-reduction coordinator.

### Slice 2.5 — Password-only membership removal

**Current status — 26 October 2026.** Ordinary User/Admin removal and self-removal
are released under password authentication. The
[production closeout](https://github.com/tomer-mayara/Thermus/blob/baff8d2a566ef39b97bd80aa8d88f6d19f839e74/review-evidence/s25-production-release-20261026/root/session-recovery-closeout/README.md)
records completed release and exact production fixture cleanup on deployed
`57c99e2b892acea52bfc3a53aee61b5ae442bf46`. It supersedes the earlier pending-review
and release holds for that scope. This is a baseline update from recorded evidence,
not a new live verification. Role changes and MFA remain Slice 3 work; settings
backup remains Slice 4 work.

**Historical state — 25 October, before production closeout.** The following
candidate table and evidence retain the earlier P2 safety-scan finding,
S2.5-R1 repair, pending review and ordered release holds. They are historical
records, not dependencies on unfinished removal for the new UI tickets.

The [S2.5-02 ledger](../implementation/admin-s2-5-02.md) alone owns the current
release gates and their ordered execution. The
[stack review](../implementation/admin-s2-5-stack-review.md) records findings,
focused checks and evidence limits. The original expanded acceptance scenarios
and TDD steps remain in the
[pinned pre-review plan](https://github.com/tomer-mayara/Thermus/blob/806ccc573c6ae09c411a47a755d6dd9316343f8f/docs/design/organization-admin-plan.md#L2417-L2902)
and the implementation records below. They remain requirements and history;
planned red steps are not evidence of an observed test failure.

| Ticket | Functional dependencies | Current state and evidence |
| --- | --- | --- |
| S2.5-01a | Existing S1-04a member/provider boundary | Implemented: narrow deletion and current management facts. [Record](../implementation/admin-s2-5-01a.md), PR #251. |
| S2.5-01b | S2.5-01a; S2-01a store; S2-03a safe recording | Implemented: durable admission, last-Admin checks and bounded lifetime. S2.5-R1 supplies the safety-scan repair; PR #253 is Draft again. [Record](../implementation/admin-s2-5-01b.md). |
| S2.5-01c | S2.5-01b | Implemented: checked Members removal and safe self-removal navigation. [Record](../implementation/admin-s2-5-01c.md), PR #254. |
| S2.5-R1 | Existing S2.5-01a/b/c implementation | Source repair and selected behavioral checks complete in PR #257. Current-head human architect approval remains pending. [Record](../implementation/admin-s2-5-r1.md). |
| S2.5-02 | S2.5-01c and S2.5-R1; actual S2-04 release before rollout | Repaired-candidate behavioral gates pass; PR #255 is Draft. Current-head human review and release gates remain. [Current ledger](../implementation/admin-s2-5-02.md). |

There is no circular implementation dependency. Development uses the existing
Slice 2 store and safe recording contract. Actual Slice 1/2 release is a removal
release prerequisite, not a prerequisite for implementing or testing the repair.
S2.5-02 remains the exit prerequisite for Slice 3 release.

#### Invariants and operation states

The [global member-write rules](#authorization-and-member-writes) own authority,
exact membership scope, full grants, management evidence and last-Admin safety.
The following table states the operation lifecycle. The
[removal runbook](../implementation/admin-s2-5-02-removal-runbook.md) owns operator
containment and scoped reconciliation.

| State | Required behavior |
| --- | --- |
| Before admission | Check current Admin authority. Failed or uncertain admission sends no provider deletion. A conflicting pending row returns busy; no queue or polling. |
| Admitted, no send | Recheck actor, organization, exact target, revision, status, management, all grants and complete active Admin count. Release SQL clients before HTTP. A proved no-send refusal can settle only this operation. |
| Possible send | Keep the hold across timeout, crash, shutdown and restart. Never replay deletion or clear the hold from a current read, elapsed time or missing restored rows. |
| Known provider result | Normal void deletion completion is applied. The documented directory-managed 422 refusal proves no effect; other deletion failures, including 404, stay unknown. A missing target found before dispatch is a stale no-send refusal. Complete only the same operation. A terminal SQL write already in flight may finish after an unknown response. |
| Durable terminal receipt | Report confirmed completion only for the same operation and outcome. After uncertain completion, use exact receipt readback; otherwise return unknown. Only a terminal row can be replaced by a new admission. |

Keep the 30-second total server budget, ten active-member pages and existing
five-second provider-call timeout. Stop later local work at deadline or shutdown;
a possibly sent request can still act remotely. The owner outlives a browser
connection. Do not release intent in unconditional cleanup. Preserve replacement
memberships and later grants. Independent operator/IdP writes need the runbook's
maintenance restrictions; application coordination is not a global transaction.

Require POST, exact origin, CSRF, current selected organization, exact target and
revision before the coordinator write. Keep POST completion separate from the next
Members GET. Applied, refusal, busy,
unavailable and unknown remain distinct. Unknown has no retry form. Use current
Members/access reads or identity-only selection/sign-in after self-removal;
refresh cannot settle a remote operation. Safe customer Audit capture uses the
trusted tenant, excludes form token/revision, and cannot undo, release or replay
removal. Restore must keep reductions held outside restored operation rows;
this adds no backup product or recovery service.

#### Evidence and limits

| Requirement | Existing evidence | Limit or remaining work |
| --- | --- | --- |
| Exact deletion, account and other-workspace preservation | Real WorkOS staging, hosted composition and disposable SQL; exact IDs, portal/MCP denial and fresh sign-in | Verify the repaired deployed candidate in the approved target. |
| Personal-factor scope | Controlled sentinels and exact membership-only adapter behavior | No live existing factor was available; no MFA API was called. Retain that limit. No enrollment, paid feature or MFA gate is added. |
| Fresh-invitation rejoin | App sends a new invitation; privileged provider API accepts it; new membership has only Admin and usable portal/MCP access | This does not prove recipient/link semantics or close inherited native invitation/mailbox gates. |
| SQL faults, contention, restart and lifetime | Real disposable SQL/process tests plus controlled provider responses | No claim about every late live-provider effect. S2.5-R1 must retain this behavior. |
| Self-removal navigation | Controlled retained-session and required-reauthentication cases; live emitted guidance followed | Current deployed presentation/access still needs proof. |
| Export and storage-outage independence | Real SQL settings/snapshots/queue with controlled sender failure; actual disposable SQL stop | Audit is best effort. A cold or expired snapshot can drop the triggering event; the export case warms its snapshot. A missing event proves no removal outcome. Earlier deployed Slice 2 export proof remains separate. |
| Restore hold | Completed empty-snapshot, data-only disposable drill with independent controlled applied evidence | No arbitrary whole-project/physical restore, live WorkOS settlement, unrelated-row restore or production backup claim. |
| Capacity and notices | Dated storage/provider inventory and complete successor proposal | Current target/capacity, exact-byte owner approval, runtime integration, publication and deployed copy remain open in the ledger. |

The 25 October review passed 204 existing focused cases: 111 domain/provider,
16 store/SQL/restart and 77 web/audit/browser cases. One web invocation failed to load
TypeScript before the corrected command passed. No complete raw 111-case log
or new screenshot was saved. These are focused review checks, not final repaired
candidate or release gates; see the stack review for commands and limits.

#### S2.5-01a — Narrow provider deletion and current target facts

Implemented in [PR #251](https://github.com/tomer-mayara/Thermus/pull/251).
The [record](../implementation/admin-s2-5-01a.md) retains observed acceptance-first
and focused TDD evidence. Preserve explicit ordinary-management evidence, all
role slugs, revision inputs, exact-ID deletion and no automatic retry.

#### S2.5-01b — One removal owner with durable per-org serialization

Implemented in [PR #253](https://github.com/tomer-mayara/Thermus/pull/253).
The [record](../implementation/admin-s2-5-01b.md) retains SQL, process-crash,
lifetime and receipt evidence. Keep the single owner and shared private SQL
runtime. S2.5-R1 changes only the unnecessary display work on its safety read.

#### S2.5-01c — Checked Members removal and self-removal

Implemented in [PR #254](https://github.com/tomer-mayara/Thermus/pull/254).
The [record](../implementation/admin-s2-5-01c.md) retains form, browser, current
access, count, scope and self-removal evidence. Keep the native confirmation,
one checked POST and fixed result with existing navigation. No status storage,
client workflow or extra recovery page is needed.

#### S2.5-R1 — Read safety facts without display hydration

**Source repair and selected behavioral checks complete; human review pending.**
The [R1 record](../implementation/admin-s2-5-r1.md) records observed red/green
steps, current behavioral gates, cleanup and limits. The maintained PR Validation
and Quality review records give current candidate pins, coverage/metrics,
eligibility and review holds. Removal now scans `memberFactsPage` without per-member
email reads; `member()` and display pages keep their current contract. The
original P2 occurred because the coordinator used `memberPage`, whose WorkOS
adapter serially fetches every member's email. Safety checks do not use email.
A cache-only probe models 100 active memberships, including one acting Admin and
an ordinary User target, and successful 300 ms user reads: display hydration
consumes the 30-second budget after admission; the
request returns unknown with no DELETE, keeps its pending row, and the next
valid request returns busy. This is conditional simulated-latency evidence,
not a production benchmark or a guaranteed organization-capacity threshold.

**Acceptance specification first.** Add a failing executable specification
through the real directory/coordinator public interfaces before source changes:

```gherkin
Scenario: Decide removal from current safety facts without display-only work
  Given 100 active memberships including the current password-authenticated Admin and an ordinary User target
  And complete current membership facts, role-catalog reads and SQL calls that complete promptly
  And each successful display-user lookup costs 300 ms of simulated time
  When the Admin submits a valid current removal of the User
  Then removal is applied within the existing 30-second operation budget
  And only the exact target membership is deleted after durable admission
  And the same operation has a confirmed terminal receipt
```

**Focused TDD steps.** For each step, add the failing test, make it pass, then
refactor with tests green:

1. Specify the narrow safety-page contract: exact membership/subject/organization,
   status, all grants and permissions, management evidence, revision and cursor.
   Add one method to the existing directory, such as `memberFactsPage`, using
   `MemberPageRequest` and the existing `Page` type. Share the safety field shape
   with `OrganizationMember` instead of copying it; email remains a display field.
   Leave `member()`, display pages and seat contracts unchanged.
2. Drive the WorkOS mapping without per-member display hydration. Retain raw
   management evidence before SDK defaulting, full role mapping, current facts,
   pagination and stop checks around every remote read. Verify zero per-member
   display-user lookups in the paged safety scan. The one existing direct target
   display read may remain; do not broaden this repair to remove it.
3. Use the facts page in the coordinator safety check. Keep the regression on the
   real adapter/coordinator; ready-made facts doubles cannot prove removal of the
   provider enrichment. Redirect removal/lifetime pause/failure test seams to the
   facts method; keep display enrichment tests on the display path. Preserve current actor,
   direct/paged target agreement, duplicate handling, later-page Admin counting,
   unsafe-grant refusal and failed/incomplete-page refusal. Keep deadline and
   shutdown behavior, one durable hold and exact receipt completion unchanged.
4. Run the new acceptance case, focused rule/adapter/lifetime cases and applicable
   SQL/restart cases. Then select complete-candidate gates, public-surface snapshots,
   registry/architecture impact and review under repository policy. A source repair
   needs the full ordinary suite, typecheck, portal build and applicable gates.
   Record actual red/green evidence and refresh final candidate pins. The public
   directory contract changes: regenerate declaration snapshots, declare its
   architecture impact and obtain T2 Need architect approval for the repair head.

Keep the timeout and pending holds. Do not substitute parallel email floods,
a cache or membership mirror, a larger deadline, a lease, replay, a feature flag,
a generic directory framework or a second coordinator. This ticket is complete
only when the acceptance case and selected checks pass on the repaired candidate.
The simulated fixture is a regression case, not a runtime throughput SLA.

#### S2.5-02 — Integrated verification, runbooks, and release

**Historical procedure; completed within the [26 October production closeout](https://github.com/tomer-mayara/Thermus/blob/baff8d2a566ef39b97bd80aa8d88f6d19f839e74/review-evidence/s25-production-release-20261026/root/session-recovery-closeout/README.md) scope.**
The following preserves the original procedure and completion criteria.

The [current release ledger](../implementation/admin-s2-5-02.md) owns every
remaining gate and release sequence. First hold and verify actual deployment
controls and the target before any push, merge or configuration action that can
trigger deployment. Pin and keep the identified no-removal deployed candidate
while the prior Slice 1/2 release completes and the repaired removal candidate
with owner-approved successor runtime notice/help is prepared and reviewed.
Then apply/check the additive schema and grants, publish/deploy the exact approved
removal candidate and verify it. No remote control change is claimed here.
Missing SQL fails closed for deletion but is not a feature-exposure or notice
switch. Keep pending operation rows through rollback.

**Done.** S2.5-R1 and final-candidate checks/reviews pass, all ledger decisions and
release evidence are complete, and the approved deployed notice/help, migration
privileges and scoped Members/portal/MCP/audit journey are verified. Only then is
S2.5-02 Done and Slice 3 release unblocked. No role/MFA feature, global-user delete,
new store/service, backup requirement or paid feature is added.

### Slice 3 — Role changes and MFA branches

After Slice 2.5, release role changes when their own checks pass; MFA may remain
unverified. Security navigation/personal MFA controls belong only to the MFA exit.

| ID | Depends on | Deliverable | Done |
|---|---|---|---|
| S3-01 | S1-05 | Confirm standalone TOTP entitlement/behavior/storage feasibility. | The MFA gate has explicit free unbound-API and isolation evidence; native-MFA pricing/$0 estimates are insufficient. Role changes remain independent. |
| S3-02 | S2.5-02 | Extend the same reduction mechanism for User↔Admin changes. | [Member-write rules](#authorization-and-member-writes) pass concurrent removal/demotion, uncertain recovery, current permissions, and self-demotion navigation. No revived grant writer/second coordinator. May release without S3-01. |
| S3-03 | S3-01, S2-01 | Durable optional enrollment/atomic promotion and explicit subject/browser-session/challenge proof, without `user_id`. | [MFA rules](#portal-mfa--slice-3-mfa-branch) pass factor binding, deadlines/replay/parallel setup, optional admission, and zero-org signup/error cases. Later create/join keeps admission. No persisted TOTP secret/key, AuthKit binding, or MCP challenge. |
| S3-04 | S3-03 | Two role-policy controls and next-sign-in decisions. | MFA sign-in/session cases pass each/both/default flags, failed reads, enrollment, selector, refresh/role/workspace changes, and current permissions. No extra policy-save challenge. |
| S3-05 | S3-04 | Own-factor removal/replacement and scoped support recovery through shared setup. | MFA lifecycle cases pass all-membership checks, mandates, stale/abandoned attempts, cleanup failure, optional-org pending recovery, and locked-out last Admin; no codes or unrelated-session/MCP revocation. |
| S3-06 | Release: S2.5-02. Role exit: S3-02. MFA exit: S3-05 | Scope-specific verification/docs/runbooks and separate branch releases. | Applicable rule/provider/$0/capacity/UI/restore checks pass. MFA proves retained old factors/policies cannot challenge MCP, not merely new-factor absence. All exclusions remain. |

### Slice 4 — Settings backup and recovery

The owner moved backups here on 24 October 2026: “Let's move backups to a new
Slice 4 - run slice 2 with no backup”. This slice is future work. It does not
promise an available recovery capability, provider restore access, or an audit
event archive. Slice 2 may release without its backup and restore proofs.

| ID | Depends on | Deliverable | Done |
|---|---|---|---|
| S4-01 | S2-04 | Select an existing $0 persistent destination outside the shared project and deployment service; name owner/delegate, custody/access, cadence/retention, and separate application/backup key recovery. Review complete notice/help changes and exact bytes before publication. | Actual access, capacity, cost, selected retention and recovery custody are proved; owner approves the complete changed notice and scope. No new paid service or backup framework. |
| S4-02 | S4-01 | Scoped encrypted private-schema backup and isolated safe restore, using the retained S2-04 procedure as a starting point. Review any later Slice 2.5/3 state before restore. | Prove archive scope and hashes, separate key recovery, dispatch/writer stop and pending-memory clear, isolated restore with fresh revisions and disabled export, current-key reconciliation, and explicit Admin review before re-enable. Touch no other application data. Resolve ambiguous reduction/MFA state with independent evidence. |

The [future Slice 4 recovery procedure](../implementation/admin-s4-recovery.md)
contains earlier proposed defaults and a disposable drill. Reassess them against
the actual Slice 4 state; they are not selected storage, approved retention,
production restore proof, or a current product guarantee. Never infer a durable
audit event buffer from settings backup work.
