# Organization signup approval package — 23 October 2026

**Status: complete version 2 bundle and publication scope approved.** The owner
answered “Approve this complete bundle and publication scope” at
`2026-10-23T19:45:23Z`. The target is `https://app.thermus.ai`.
This records legal approval, not completed publication, signup opening, or human
approval of a later code candidate. Required operational checks remain separate.

The actual approval is retained in the restricted operator store at
`~/.codex/operator-records/organization-signup-2026-10-23-v2-approved/`:
`approval.json`, `review-manifest.json`, and exact legal byte copies. The directory
is mode 0700 and files are mode 0600. The frozen review manifest SHA-256 is
`71ad7ced1d7be1e0b00aba4516e3408dd07893d19675c011ba017e8a9c54cf12`.
The review manifest keeps its historical UNAPPROVED status. As with FS-04, the
separate approval record supplies the later approval; the review history is not
rewritten. The approved terms, privacy, and agreement bytes remain unchanged.

## Approved complete documents

Read the complete [Terms of Service](../legal/organization-signup-2026-10-23/terms.md),
[Privacy Policy](../legal/organization-signup-2026-10-23/privacy.md), and
[exact checkbox](../legal/organization-signup-2026-10-23/agreement.txt).
The [manifest](../legal/organization-signup-2026-10-23/manifest.json) records the
bundle `s105-organization-proposal-2026-10-23-v2`, each document version,
byte count, and frozen review SHA-256. The
[complete diff](../legal/organization-signup-2026-10-23/changes.patch) shows all
changes from the frozen personal documents.

The [frozen source](../../src/accounts/providers/workos/workos-approved-signup-documents.ts)
was approved for implementation only under [FS-04](fs-04.md). Its personal User
agreement cannot authorize new organization/first Admin creation. This package
applies the exact [existing organization proposal](admin-s1-05-legal-proposal.md),
then adds current `app.thermus.ai` portal/MCP coverage while retaining the legacy
URLs, and the approved effective date of 23 October 2026. Version 2 also corrects
the retained page-only description to cover current web search inputs, Brave Search, returned results, processing permissions, and
scoped logging facts. See the [source data-flow review](../legal/organization-signup-2026-10-23/data-flow-review.md).
The privacy text also retains the current marketing contact-form disclosures,
including field collection, Netlify/mailbox copies, page-only drafts, and
retention/deletion of both copies. The manifest pins that source to marketing
commit `1c025d8a51707a0b5130cdb72f796f51ef22ec64` and its SHA-256.
These additions are included in the approved complete version 2 package. If publication/opening is delayed,
revise the date, versions, and hashes and obtain approval again.

## Approved owner decisions

The product flow already requires one initially unchecked creator agreement for
an organization, followed by its first Admin. Invited Users and Admins have
readable legal links and no separate checkbox or acceptance record. The recorded complete-bundle approval covers the legal basis and wording below:

- The organization is the contracting party. The creator confirms authority to
  bind it, including for their own business or with a personal email address.
  Verified email does not prove age, employment, or authority.
- Invited Users and Admins use the workspace under that organization agreement.
  Apply the adult age 18 and business-use requirements to hosted use, including
  invited use, under that basis. Do not treat an invitation, sign-in, role, or
  MCP authorization as each person's express agreement. No application age or
  authority verification is added by this text.
- Confirm that the complete processing permissions and privacy
  provisions fit organization use, including legal roles, lawful bases, and
  international transfers. This package adds no DPA or new legal role or basis.
  If those provisions change, revise the complete text and obtain new approval.
- Approve the exact complete bytes in the manifest, the checkbox, presentation,
  current and historical service coverage, search/provider/logging facts,
  versions, and effective date. No changed bytes may reuse an old approved version.

The earlier production cutover found no users, memberships, or pending
invitations. Obtain a fresh inventory before opening; that earlier result is not
a fresh read. Preserve retained historical agreements and signup records. No
current-user transition is proposed here. If the fresh inventory requires one,
prepare its scope and obtain approval before execution.

## Publication dependency

The signup page renders the complete notice before sign-in and the complete
terms and notice before the checkbox. Its links target the local `#terms` and
`#privacy-notice` readers; see [signup pages](../../src/interfaces/web/auth/workos/workos-signup-pages.ts).
These readers show the runtime bundle. The recorded approval covers that public display.
They are not independent public policy routes.

The [signed-in portal footer](../../src/interfaces/user-portal/portal.ts) links
to `https://thermus.ai/privacy` and `https://thermus.ai/terms`. The complete terms
also link twice to `https://thermus.ai/privacy/`. Those are marketing-hosted
policy destinations. Rendering the approved bundle inside signup does not
update them or make them the same version.

The approved publication scope is to publish the same complete approved terms
and privacy content at those existing marketing destinations, with matching
version/date evidence, before opening signup. Keep these Markdown byte copies
and hashes as the source; HTML may add presentation but must preserve all text,
links, tables, and attribution. Verify the rendered pages and redirects. Portal
readers alone do not satisfy the existing footer and terms links. This package
does not itself publish or change the marketing repository. A different
destination plan would need a concrete link/publication change and review.

Marketing PR 24 has since merged as
`4afdad5c8869296b3bbf8b376ee98c6fcdc4d01a`. Netlify deploy
`6adbbde44eb3dfaaa5af6abb` published that exact merge at 20:05:18 UTC on
23 October. Public verification passed at all four `/terms`, `/terms/`,
`/privacy`, and `/privacy/` destinations: complete semantics and punctuation,
links, ten table rows, date, versions, and hashes match the approved package.
Same-host 301 redirects finish at 200. Eight JavaScript-disabled visits at widths
375 and 1280 confirm direct mailto links, no email obfuscation, and no horizontal
overflow. The marketing repository retains
`reports/legal-publication/production/verification.md`, JSON, and screenshots.
The Thermus runtime candidate is not merged or deployed, and production signup
remains closed. Public verification changes no approved legal bytes and waives
no runtime or release check.

## Complete scope presented for approval

The complete scope presented to the owner was:

> I approve the complete organization Terms, Privacy Policy, and checkbox in
> bundle `s105-organization-proposal-2026-10-23-v2`, with the exact versions and
> hashes in its manifest, and the proposed owner decisions above. I approve the
> current and historical service URLs and the proposed 23 October 2026 effective
> date. I approve implementing and publicly displaying that bundle in the
> production signup flow, and publishing the same complete terms and privacy
> content at the existing thermus.ai policy destinations. I approve opening
> signup at app.thermus.ai after the required checks, publication, fresh inventory,
> and separate operational release holds are resolved. If the date or any text
> changes, return the revised complete bundle for approval. This does not
> authorize a user transition, record deletion, or unrelated access change.

The actual concise owner response and time are recorded above and in the
restricted approval record. The quoted scope explains what was presented; it is
not substituted for the actual response. Changed bytes or dates need new approval.

## Work after approval

Supply the exact approved bundle in runtime with `purpose: 'organization-creation'`
and the new versions and hashes. Do not change the old frozen manifest or turn
personal acceptance into organization authority. Update the affected source tests
and run the required checks and review. Verify complete readable documents, one
unchecked checkbox, displayed versions, saved hashes, and the production target.

Reconcile the [onboarding invitation text](hosted-user-onboarding.md) with the
approved organization-agreement basis. Correct the stale backup requirement in
the [acceptance template](templates/hosted-terms-acceptance.md); the owner already
removed that prerequisite. These document fixes add no new approval gates.
The [release evidence](admin-s1-staging-release-verification.md) and
[native invitation matrix](../testing/workos-invitation-proof-matrix.md) retain
separate operational holds. Alternate joining fails even for a newly verified
identity; a fresh exact-address reinvitation works. Concurrent revoke still
leaves a generic native error; ordinary login in a new browser context restores
unrelated authorized access. After required checks, the owner must decide the
release disposition of these limitations and the deferred mailbox checks. This
package records no waiver, policy change, or claim that the native errors are
fixed. The diagnostic probes pin `285f5f044409775c864556c335ca17f9d7f64c1f`;
they do not validate the later runtime candidate.

## Production facts checked — 23 October 2026

The manager's retained production readback supports these current facts. The
[data-flow review](../legal/organization-signup-2026-10-23/data-flow-review.md)
gives the source, provider-document links, and evidence limits.

| Item | Readback |
| --- | --- |
| AuthKit limits | Session 365 days; inactivity 48 hours; access token 5 minutes. |
| Invitation validity | 7 days. |
| Sign-in and signup | Password enabled; MFA off; Google and SSO disabled; provider `allowSignUp: false`; application signup closed. |
| Render logging | Thermus AI workspace is Hobby: 7 days of accessible application logs and no configured default log-stream destination; no per-service custom override. |
| Live production candidate | `9de610e8b75dfa041dcf18c5380ccf80feb9f797`, deployment `dep-dbdq0hnavr4c73908k4g`. |

The production entry uses the console logger; it configures no application OTLP
logger. Readbacks cannot prove whether a person made an ad hoc log export.
Avoiding routine exports or extra log stores remains an operating commitment
covered by the complete approved package. This readback alone proves no
publication or operational release.
