# Organization administration plan

Plan date: 22 October 2026. Status: design for review, not implementation.
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

| Slice | Shipped scope |
|---|---|
| 1 — Basic Admin portal | Narrow provider boundary, User/Admin roles, named organization and first Admin, creator agreement, active-member list, native invitations/acceptance, and workspace selection. Product + Members navigation; no member removal, role changes, MFA gate, flags, factors, or policy UI/state. |
| 2 — Collector export | Slice 1 plus Logging settings, safe content capture, and bounded best-effort export. Password only; no MFA dependency or member-reduction coordinator. |
| 2.5 — Member removal | Slice 2 plus Remove, including self-removal, with durable last-active-Admin protection. Password only; no role changes or MFA features. |
| 3 — Role changes and MFA | Change role reuses the Slice 2.5 coordinator and may ship independently of MFA. The separate MFA branch adds organization Security and personal factor controls after its free-entitlement/behavior gate passes. |

Release in order **1 → 2 → 2.5 → 3**. Read-only feasibility work may run early.
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

## Existing code, boundaries, and ownership

Signup is disabled by default and currently creates a personal workspace with
User. Existing grants distinguish User, Admin, and Super Admin. Account pages
manage grants/invitations; administration requires MFA, with proof limited to
Required-policy Password sign-in. Customer destination storage/export routing do
not exist. Existing [tool completion records](../../src/interfaces/mcp/tool-completion-record.ts)
include URL origin/path and reason in operator output; Slice 2 must remove that
content from operator completion records.

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
| Logging/app lifecycle | Customer capture, bounded delivery, and shutdown. |

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
and approved palette. Members, Logging, and later Security are Admin navigation.
Account security adds MFA only in Slice 3. Browser workspace selection does not
change an existing MCP client's workspace.

Use labels, radio groups, status text, visible focus, and controls at least 48px
high. Ordinary forms and selection work without JavaScript. Use one column/cards
on narrow screens; wrap long values, preserve zoom/full labels, and announce
asynchronous results. Keep only non-secret input after safe errors. Never return
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

### Members and invitations — Slice 1, with later actions

Show active members and WorkOS-pending invitations with current expiry and allowed
resend/revoke actions. No accepted-invitation history or setup rows. An empty
pending section can be a sentence. Slice 1 has no member-row mutations:

```text
Thermus       Workspace [Acme Labs v]             Alex  [Sign out]
Connect your agent | Members
                     -------
Members                                           [Invite member]
Email                          Role
alex@example.com               Admin · You
sam@example.com                Admin
jo@example.com                 User
Pending invitations
nia@example.com          Admin    3 days left    [Resend] [Revoke]
```

Slice 2 adds Logging navigation. Slice 2.5 adds `[Remove]` on member rows.
Slice 3 adds `[Change role]`; Security navigation appears with the MFA branch.
Add security to the Admin role description only when that branch ships.

```text
Invite to Acme Labs
Email address [ name@example.com                               ]
(*) User — use Thermus and connect an MCP client
( ) Admin — also invite members
[Send invitation]                                      [Back to members]
Sent: Invitation sent.
Existing member: This address is already a member. [Back to members]
Pending invitation: An invitation already exists. [View pending invitations]
```

Use native confirmation pages. Each example state appears only when applicable.

```text
Slice 2.5 — Remove jo@example.com from Acme Labs?
Jo loses access here; account and other memberships remain.
Rejoining needs a new invitation. [Cancel] [Remove member]
Last Admin: Another Admin must join before you leave.
[Back to members] [Invite Admin]
Unsupported membership: Ask the operator to review its current state.
Changed since opening: Reload and review the member.
Unknown result: We could not confirm the removal. [Check current status]
After self-removal: [Choose workspace] [Sign out]

Slice 3 — Change jo@example.com's role · Current role: User
( ) Admin — product/MCP, members, and logging
(*) User — product/MCP
[Cancel]                                                   [Save role]
Last Admin: Another Admin must join before you change to User.
[Back to members] [Invite Admin]
Unknown result: We could not confirm the role change. [Check current status]
```

### Organization and personal security — Slice 3 MFA branch

```text
Thermus       Workspace [Acme Labs v]             Alex  [Sign out]
Connect your agent | Members | Security | Logging
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

### Logging — Slice 2

```text
Thermus       Workspace [Acme Labs v]             Alex  [Sign out]
Connect your agent | Members | Logging
                               -------
Logging destination
[ ] Enable export
Collector endpoint [ https://collector.example.com/v1/logs       ]
Connection: HTTPS · OTLP/HTTP JSON
Authentication: ( ) None   (*) Bearer token
Token [                                                        ]
Saved token: Set · Blank retains it only for unchanged endpoint/auth.
Changed endpoint + Bearer requires a new token. None removes the saved token.
[Save]
[Test saved destination — optional]
Test: All test records accepted at 10:42 AM. Check your collector.
Testing is recommended, not proof of continued delivery or storage.
Enabled export includes MCP tool inputs/results and administration metadata.
Oversized logged results are truncated with original size shown;
your tool result is unchanged.
No internal HTTP/sign-in forms/cookies/Authorization headers/logging tokens.
Delivery is best effort. Overload/restart can lose logs; retries may duplicate them.
A slow or unavailable Collector never delays tools.
```

### Narrow screens — Slice 1

```text
Thermus                                         [Menu]
Workspace [Acme Labs v]
Members                                  [Invite member]
alex@example.com · Admin · You
Pending invitations
nia@example.com · Admin · Invited · 3 days left
[Resend] [Revoke]
```

The menu exposes only shipped pages/actions plus ordinary account/sign-out
controls. Keep endpoint text, focus, and controls usable without horizontal scroll.

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

### Customer logging — Slice 2

Current Admin permission and password authentication authorize settings/Test.
The later MFA branch adds its portal session gate without changing this export
contract or MCP authorization.

**Content and routing.** Enabled export includes validated MCP inputs and final
public results/errors: search queries, requested URLs, fetched text, and reasons,
plus administration metadata. No content checkbox or metadata-only mode. Exclude
internal HTTP traffic, sign-in forms, cookies, Authorization headers, and logging
tokens. Redact known credential fields/recognized credential-bearing URL params;
arbitrary free text cannot be promised secret-free.

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
MFA-policy, and logging actions as each ships. Use independently trusted tenant/
actor context; a request-supplied organization ID is not routing authority. A denied
request from Org A naming Org B must not send metadata to B's Collector without
independently established B context. Unattributable attempts stay in sanitized
operator diagnostics. Export no global personal-factor/support actions into
tenants; support's scoped operator record stays separate. WorkOS authentication
logs remain in WorkOS, without promised direct provider/IdP coverage. Proposed
fields are timestamp, event name, opaque actor/org IDs, operation, status, duration.

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

At event creation, use an available per-org settings snapshot. Disabled/unknown
snapshots drop that event; never retain it for later Enable. Bind queued work to
tenant/revision. Eligible trusted-tenant activity schedules asynchronous loading
of missing or due-for-refresh snapshots, including cached-disabled values. Allow
one in-flight load per org and bound admitted work, time, and resources. Never
await this snapshot refresh in a tool/admin response path. A successful load affects future captures
only; never revive old content/revisions. Idle tenants cause no reads. S2-03
chooses/documents fixed refresh/backoff bounds; add no general cache framework.

Customer sink failure cannot change tool results or fail/replay completed admin
actions. Isolate it from throwing post-write `ChangeRecording.record` calls and
tool execution; capture/enqueue remains bounded.

**Settings and Test.** Use one public HTTPS Collector endpoint, None or one Bearer
token, native radios, and a write-only Token field. No private-network destination,
custom auth headers, or client certificate. One validated Save atomically applies
endpoint, auth, and Enable; failed validation applies nothing. New settings start
disabled until explicitly enabled. Every actual change, including toggles, updates
one revision; unchanged Save does not. No draft/active copies. None removes the
saved token. Blank Bearer retains it only for unchanged endpoint/auth; changed
endpoint + Bearer needs a replacement. Encrypt secrets server-side with a key
outside the store; never echo them. All writes reject stale forms/revisions.

Optional Test uses the saved version, works disabled, sends a labelled synthetic
event, and never saves/enables. Save unsaved input first. Ignore late results after
a revision change. Keep no history/dashboard/version controls. Show the submitted
result; Test proves neither continued delivery nor durable storage and is never a
prerequisite to enable.

**Egress and revisions.** At actual connection, enforce public HTTPS/IP, allow
Collector paths, reject userinfo/fragments/all queries, and follow zero redirects.
Prevent private/loopback/metadata-service access and credential forwarding. Isolate
customer TLS/headers from platform OTEL defaults; the pinned SDK can merge headers.
Other protocols/query-auth are deferred.

Async dispatch/retries read enabled/current revision across instances only when
work exists, before send/retry; add no idle polling or keepalives. On settings
change, including disable→enable, drop old-revision work; never retarget it. Stop
new dispatch when a change is observed. In-flight sends may finish; cancel when
possible, but sent data cannot be recalled. Settings-read failure stops export
without blocking product. Synthetic tests share the bounds and submitted saved
revision, with the explicit disabled-state exception.

**Delivery and protocol.** Use a bounded in-memory queue, no durable queue/replay
service/export worker. Slow/unavailable Collectors never delay tools or completed
admin actions. Overload/restart can lose logs; retries may duplicate them. Bound
global/tenant items/bytes, active destinations, concurrent sends, payload/response
sizes, retries/time, and use the existing shutdown deadline.

Follow [OTLP](https://opentelemetry.io/docs/specs/otlp/) and validate actual
OTLP/HTTP JSON with None/Bearer. Parse bounded responses: full acceptance,
acceptance with warning (zero rejected), partial rejection, failure, or unconfirmed
outcome. A warning with zero rejected is not a retryable failure. Never retry
partial/permanent failures. The pinned exporter's callback cannot establish partial
acceptance; a narrow OTLP/HTTP JSON sender is allowed. Sanitize diagnostics and
promise no universal receiver or direct Axiom/Grafana support.

## Open gates and release procedure

Evidence below was recorded on 22 October 2026. Each gate applies only to its
shipped slice; no resources/provider settings changed.

| Slice | Established | Remaining proof |
|---|---|---|
| 1 invitations | Documented recipients and pinned native lifecycle contract. | Prove the remaining [native active-role preservation and race cases](#native-invitations--slice-1); otherwise hold release and ask the user. No custom acceptance/activation registry. |
| 2 settings; 2.5 coordination; 3 MFA facts | Authenticated Supabase dashboard confirms the selected project's identity, Free plan, health/region, and current usage. Account eligibility is resolved. | Follow [owner setup](#owner-setup-for-supabase--slice-2); prove SQL isolation, capacity, TLS, persistence, failure, and scoped recovery before rollout. Recheck usage then; connector access is no gate. |
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
| 1 | No new app database: existing provider metadata/external IDs hold creation/legal recovery. No logging or MFA prerequisite. |
| 2 | Collector endpoint/auth/enabled state, revision, and encrypted optional Bearer credential. No member-reduction coordinator yet. |
| 2.5 | Per-org serialized-operation and unknown external-write records that survive crashes/restarts. |
| 3 | Role changes reuse those records; MFA adds role-policy flags, factor associations, and scoped recovery state, never TOTP secrets. |

Exported tool content and its bounded best-effort queue stay in memory, never in
the database; store no TOTP secrets or general session registry.

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
query durations, not just pool size. Handle idle-pool errors safely and release
or destroy connections within the existing app shutdown deadline. Test stalled
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

Free requires [our own regular backups](https://supabase.com/docs/guides/platform/backups):
logical exports of Thermus's private schema and needed role/grants, encrypted to
existing operator-owned persistent storage outside the service/project at $0
added cost. Set owner/cadence/retention/key recovery and drill a scoped restore
before release; never export/overwrite other applications' data. Before restoring,
stop export dispatch and clear in-memory pending work. Restored export stays
disabled until an Admin reviews and explicitly re-enables its destination. Hold
member reductions and later MFA admission until the operator resolves ambiguous
state with independent evidence, not restored rows or an unchanged WorkOS read
alone. Add no backup service/framework.

Outage/pause stops export and sensitive storage-dependent writes; fresh portal
admission in the MFA branch fails closed. MCP and already-admitted portal product
access remain usable with current WorkOS identity/membership checks. Do not restart
healthy Node, cause health-check restart loops, or blanket MCP logout.
Update deployment/pause/quota/reconnect/recovery runbooks during implementation.

### Owner setup for Supabase — Slice 2

Owner means the Thermus deployment operator with Supabase/Render access. This is
platform setup; customer Admins use Logging for Collector settings. These variables
are a **planned S2-01 runtime contract**, absent from current code. Add validation/`.env.example`
placeholders before rollout. Missing values disable Slice 2 storage/export;
preserve MCP and already-admitted portal product access under the outage rule
above. Slice 1 needs no database setup.

| Planned variable | Server runtime value |
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
2. The implementer then prepares reviewed S2-01 setup. Apply its scoped migrations
   and [restricted runtime `LOGIN` role](https://supabase.com/docs/guides/database/postgres/roles).
   Proposed names are `thermus_app` and private schema `thermus_admin`; check them
   against the existing database. Give the role its own password and only needed
   rights. Keep privileged owner/`postgres` credentials for setup, never the app;
   leave existing shared-project data untouched.
3. In [Connect → Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres),
   copy and recheck the selected project's details at rollout. The authenticated
   view showed host `aws-1-us-west-2.pooler.supabase.com`, port `5432`, database
   `postgres`, and free IPv4-proxied session pooling. No connection was tested;
   the direct IPv4 add-on is not needed. For the future restricted role, use
   `thermus_app.rnqktgtgrvvqptbaosth` and its URL-encoded role password. The supplied
   HTTPS API URL is not the DB URI. Require certificate
   and hostname verification: use default trust when valid, or the
   [official CA for that endpoint](https://supabase.com/docs/guides/platform/ssl-enforcement)
   if needed. Keep SSL query parameters out of `DATABASE_URL`. S2-01 explicitly
   configures verified `pg` TLS and rejects all conflicting URL SSL options,
   including `ssl`; examples are `sslmode`, `sslrootcert`, `sslcert`, and `sslkey`,
   which can [replace its SSL configuration](https://node-postgres.com/features/ssl).
4. Generate the independent key locally, for example with `openssl rand -base64 32`.
   Do not reuse a WorkOS/cookie secret. Keep the role password and stable key in the
   existing password manager/recovery storage. If a CA file is needed, confirm
   that the app can read its configured runtime path.
5. Open the existing [Render Thermus service](https://dashboard.render.com/web/srv-db8mnqg473hc739d529g),
   then [Environment → Add Environment Variable](https://render.com/docs/configure-environment-variables).
   Add only service-scoped server values. **Save only** stages them until the next
   deploy; coordinate activation with S2-01 code. **Save and deploy** redeploys the
   existing build; **Save, rebuild, and deploy** rebuilds it. For an optional public CA,
   use Secret Files → Add Secret File; **Save Changes triggers a deploy**. Coordinate
   it with rollout and verify the [Docker runtime path](https://render.com/docs/docker-secrets)
   `/etc/secrets/<filename>`. No environment group/config service is needed.
6. Before Slice 2 rollout, prove actual TLS/role/schema isolation, persistence, and
   the storage section's SQL bounds, outage, backup/key-recovery, and $0 checks.
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
with the relevant slice. Before Slice 2 export, approved privacy notice/Logging
help must explain input/result export. Slice 2.5 documents removal/uncertain-write
recovery; Slice 3 role changes extend those procedures, while MFA separately needs
validated identity/recovery steps and proof of retained-factor MCP safety.

This plan-only revision needs manual document/link/mock checks, no source tests,
provider actions, runbook/legal-source edits, commit, or PR.

## Appendix — implementation tickets

These IDs are plan-local, not external issues or implementation authorization.
Dependencies identify functional prerequisites; release exits also enforce
1 → 2 → 2.5 → 3. Each ticket follows the canonical rules, free-only rule, and
verification procedure above. S1-03 and S1-04 remain group references: each is
complete only when both of its child tickets are complete.

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
logging, member reduction, role-change, or MFA feature.

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

**Current gap / expected red, not run.** Signup uses a fixed personal-workspace
name and grants User. Its existing agreement/recovery behavior is useful but does
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
`test/unit/auth-workos/workos-signup.test.ts`, and
`test/acceptance/auth/hosted-workos-signup.test.ts` plus presentation cases.

**Done.** Named, agreed, verified creation produces the confirmed first Admin and
the matching named-organization landing. Legal approval remains a rollout requirement.

#### S1-03b — Creation recovery and eligibility

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

**Current gap / expected red, not run.** The portal has no Members navigation;
existing account pages show grant controls, separate invitation views/history,
and older role authority. Shared members lack the trusted target subject for You
and invitations lack display expiry. Several
native send/resend/revoke safeguards already exist and stay characterized.

**Ordered TDD steps:**

1. Add navigation and Members projection acceptance. Compose Product/Connect,
   Members, and the existing selector for Admin; User gets product navigation.
   Keep Logging/Security and Remove/Change role absent. Extend needed directory/view
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
  Given an invitation-return callback with multiple eligible memberships
  And no validated selected or joined organization context
  When the Thermus landing is resolved
  Then the existing workspace selector opens without guessing an organization
```

**Current gap / expected red, not run.** Selected-organization guide behavior
already works and stays green. Invitation-return landing without validated
selection/joined context is the new source gap. Ordinary returning sign-in with a
valid selection/safe return path must not force reselection. Native preservation/race
cases are unproven provider behavior, not claimed failing source tests.

**Ordered TDD steps:**

1. Characterize selected-organization landing and safe ordinary return paths.
   Add the ambiguous invitation-return case; derive landing only from validated
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

**Homes and anchors.** Use [session callback](../../src/interfaces/web/auth/workos/workos-session-routes.ts),
[organization selection](../../src/interfaces/web/account/account-routes.ts), and
[portal guide](../../src/interfaces/user-portal/portal.ts). Reuse hosted
organization/signup-guidance acceptance, session/selection integration cases,
and `test/acceptance/auth/hosted-live/` with existing WorkOS/browser drivers.

**Done.** Landing/selection acceptance and retained guide cases pass; actual
provider evidence settles the named cases safely without changing ordinary returns.

#### S1-05 — Complete journey, verification, and cutover

**Acceptance specification first — add/reuse the executable case after dependencies:**

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

**Integration evidence, not run.** The journey is specified here before work,
but its executable case waits until the prerequisite behaviors are ready. It may
already pass; retain that evidence without manufacturing a failure. If integration
exposes missing source behavior, specify it red in the owning ticket before its
focused TDD fix. S1-04b retains ambiguous-return, selector, and MCP-binding proof.

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

| ID | Depends on | Deliverable | Done |
|---|---|---|---|
| S2-01 | S1-05 | Connect the confirmed existing Free project through ordered [owner setup](#owner-setup-for-supabase--slice-2); add private SQL settings, validated runtime configuration/`.env.example`, and endpoint/auth/Enable/Save UI. | [Storage](#selected-supabase-postgresql) and [Save](#customer-logging--slice-2) rules pass. Recheck usage before rollout; stalled acquisition/query and idle disconnect stay bounded with MCP available. Prove tenant/revision, TLS/isolation, persistence, scoped restore/key recovery, and $0 runtime checks. |
| S2-02 | S2-01 | OTLP/HTTP JSON sender and optional saved-destination Test. | Actual None/Bearer Collector integration passes protocol/egress rules, including zero-rejection warnings, partial rejection, disabled Test, and late results. |
| S2-03 | S2-02 | Tool/admin customer capture, operator-content removal, snapshot loading, and bounded queue; document refresh/backoff/byte limits. | [Logging rules](#customer-logging--slice-2) pass: cold enabled restart, remote Enable with cached-off state, recovery after read failure, and later activity exporting after load; idle tenants do no reads. Test maximum-input/UTF-8 budgets, sink failure, tenant/revision isolation, and shutdown. |
| S2-04 | S2-03 | Integrated verification, [owner rollout](#owner-setup-for-supabase--slice-2), runbooks, approved privacy/Logging help, and release. | Storage/logging/Collector rules pass; help explains content and best-effort limits. Product/Members/Logging ship without MFA or removal coordination. |

### Slice 2.5 — Password-only membership removal

| ID | Depends on | Deliverable | Done |
|---|---|---|---|
| S2.5-01 | S2-04 | Ordinary/self-membership removal and durable per-org reduction intents in the same adequate store. | [Member-write rules](#authorization-and-member-writes) pass current/stale, concurrent last-Admin, crash/timeout/late-write/restart cases. Self-removal navigation works; other memberships/shared factor remain. No role/MFA work. |
| S2.5-02 | S2.5-01 | Removal UI/docs/runbooks, verification, and release. | Provider/storage/UI/error checks pass; enabled export uses the existing safe sink. Members adds Remove only after Slice 2, independent of MFA feasibility. |

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
