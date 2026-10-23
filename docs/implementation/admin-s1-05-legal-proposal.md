# S1-05 organization terms change proposal

Status: proposed wording only, 23 October 2026. Not approved or published.
Do not wire this proposal into runtime until the owner approves the complete
revised bundle. This is product alignment for the accepted Slice 1 plan, not
legal advice or a claim that the wording is enforceable. Owner legal decisions
remain open below. Signup, publication, existing-user transition, provider
changes, and cutover need their separate authority.

## Authoritative input and version control

The input is the complete source bundle in
[workos-approved-signup-documents.ts](../../src/accounts/providers/workos/workos-approved-signup-documents.ts).
[FS-03](fs-03.md) records its frozen review provenance;
[FS-04](fs-04.md) records separate approval of those exact bytes for implementation,
not publication or signup opening. That approval does not cover this proposal.

| Item | Current identifier | Proposed identifier, pending approval |
| --- | --- | --- |
| Bundle | `fs03-review-2026-10-16-v1` | `s105-organization-proposal-2026-10-23-v1` |
| Terms | `hosted-terms-review-2026-10-16-v1` | `hosted-terms-organization-proposal-2026-10-23-v1` |
| Notice | `hosted-privacy-review-2026-10-16-v1` | `hosted-privacy-organization-proposal-2026-10-23-v1` |
| Checkbox | `hosted-agreement-review-2026-10-16-v1` | `hosted-agreement-organization-proposal-2026-10-23-v1` |

These proposed identifiers have no effective date or approved hashes. Freeze the
complete revised UTF-8 bytes and compute new hashes only after resolving the
owner decisions. Never reuse the current identifiers for changed bytes. Keep
the frozen manifest and existing acceptance records unchanged.

Each anchor below identifies one current paragraph by its exact opening text.
Replace that whole paragraph only, unless the instruction names a sentence or
table row. Keep every unrelated clause, heading, link, and data fact byte-for-byte.
The replacements do not change liability, jurisdiction, retention periods,
provider residual-record limits, fees, or page-processing and logging facts.

## Terms replacements

### Section 1: acceptance paragraph

Replace the paragraph beginning `You accept these terms when you expressly agree`:

> You accept these terms when you expressly agree to them, including by submitting the waitlist form with the notice linking to these terms, or by selecting the agreement checkbox and submitting the hosted organization creation form. Hosted early access is for business use by adults aged 18 or older. You must be legally able to enter into this agreement. To create a hosted organization, you must accept these terms for that organization and confirm that you have authority to bind it.

### Section 1: eligibility paragraph

Replace the paragraph beginning `When self-service activation is available`:

> When self-service organization creation is available, you may request free access with an email that WorkOS reports as verified. Personal and company email addresses are eligible. This route requires no company domain, email allowlist, or proof of employment. Email verification does not verify your age, employment, or authority to act for an organization. You must review the terms and privacy notice presented on the organization creation form and make the statements in its agreement checkbox before submitting it.

### Section 1: personal workspace and roles paragraph

Replace the paragraph beginning `Self-service activation creates an isolated personal workspace`:

> Self-service organization creation creates a named organization and gives its creator the first Admin role after creation and access are confirmed. User permits product and MCP access. Admin includes that access and permits viewing members and managing invitations. Access remains subject to current organization membership and permissions. Creation does not add you to Thermus’s internal organization. An organization role or invitation does not give you authority to bind an organization to a contract.

### Section 1: authentication and invited use paragraph

Replace the paragraph beginning `Signing in with Google or WorkOS`:

> Hosted sign-in uses email and password through WorkOS. Signing in, accepting an invitation, or authorizing an MCP client does not itself accept these terms or an updated version of them. An authorized Admin can invite Users and Admins to use the organization’s workspace under the organization’s agreement; Thermus does not ask an invited member to accept a separate agreement when joining. Authentication and MCP authorization alone do not grant product access. If you already have access, signing in or selecting Continue does not itself record agreement to an updated version. Posting these terms does not by itself replace an existing agreement.

Owner decision: approve the proposed organization-agreement basis for invited
use. It must not be read as evidence that each invited person accepted terms.
The adult/business eligibility requirement remains; see the open decision below.

### Section 2: administrator paragraph

Replace the paragraph beginning `An organization administrator must have authority`:

> An organization administrator must have authority to invite members and assign either available invitation role. Administrators are responsible for assigning appropriate access and requesting removal of access that is no longer needed. The portal does not provide member removal or changes to an existing member’s role. Contact legal@thermus.ai for access-removal requests. An organization role or invitation does not give a person authority to bind the organization to a contract. Each user must stay within their assigned permissions; WorkOS authentication alone does not grant a Thermus role.

### Section 6: identity-provider paragraph

Replace the paragraph beginning `WorkOS supports hosted identity`:

> WorkOS supports hosted identity, sessions, organization access, and MCP client authorization. Hosted sign-in uses email and password. Render hosts the hosted service. Their roles in handling data are described in the Privacy Policy.

### Section 9: removal sentence only

Within the paragraph beginning `You may stop using the Services at any time`,
replace only `An authorized organization administrator can remove a member’s organization access.` with:

> An authorized organization administrator can request removal of a member’s organization access by contacting legal@thermus.ai.

Keep the rest of that paragraph, including retained-record and token limits.

## Privacy notice replacements

### Section 2, Hosted accounts: sign-in paragraph

Replace the paragraph beginning `We use WorkOS AuthKit for hosted sign-in`:

> We use WorkOS AuthKit for hosted sign-in. Hosted sign-in uses email and password. Google sign-in is not part of hosted sign-in. This change does not delete identity information retained from earlier Google sign-ins. The earlier Google sign-in requested the identity scopes `openid`, `email`, and `profile`, not access to Gmail, Google Drive, or Google Calendar content.

### Section 2, Hosted accounts: MFA sentence only

Within the paragraph beginning `We process the WorkOS user identifier`, replace
only `The portal uses security values and multi-factor authentication status to protect access.` with:

> The portal uses security values to protect access. The portal does not use multi-factor authentication status as an application access requirement.

Keep all surrounding profile, session credential, and provider-data facts.
This does not claim that an account’s provider enrollment has been deleted.

### Section 2, Hosted accounts: organization operations paragraph

Replace the paragraph beginning `WorkOS stores organization memberships, roles, and invitations`:

> WorkOS stores organization memberships, roles, and invitations. We read this information to check access and send authorized invitations and invitation changes to WorkOS. User permits product and MCP access. Admin includes that access and permits viewing members and managing invitations. The portal does not provide member removal or changes to an existing member’s role. Authorized organization administrators can see member or invitee email addresses, roles, and status.

### Section 2, Signup: initial record paragraph

Replace the paragraph beginning `For a new self-service activation`:

> For new self-service organization creation, we read your current WorkOS email verification status and record the creator’s initial agreement for the named WorkOS organization. We store the creator’s user identifier, the acceptance time, and the versions of the terms, privacy notice, and agreement wording shown. We also store the organization’s name and an enrollment identifier based on the WorkOS environment and creator’s user identifier, without using the email address. While this record remains, repeated signup cannot automatically create or restore access. Invited Users and Admins do not create a separate signup agreement record when joining. Earlier personal-workspace records retain their original purpose.

The source `RECORD_KEYS` in
[workos-signup.ts](../../src/accounts/providers/workos/workos-signup.ts) confirms
these ten metadata keys: `schema`, `subject`, `authority_accepted_at`,
`documents_version`, `terms_version`, `terms_sha256`, `notice_version`,
`notice_sha256`, `agreement_version`, and `agreement_sha256`. The name and stable
external ID are organization fields, not extra metadata keys. The schema is
`thermus-signup-v2`; the timestamp is server-recorded authority acceptance. The
terms and notice hashes identify their exact text, and the agreement hash is
computed from the exact UTF-8 agreement wording. These implementation details
support the plain-language description above.

### Section 2, Signup: retained text paragraph

Within the paragraph beginning `We retain the exact versioned terms`, replace
only `Google sign-in and MCP connection consent are separate from acceptance of Thermus terms.` with:

> Sign-in and MCP connection consent are separate from acceptance of Thermus terms.

Keep the notice-versus-consent distinction and every limit on what records prove.

### Section 4: Google provider bullet

Replace the bullet beginning `**Google:**`:

> **Google:** processed Google sign-in when that method was used and provided identity information through WorkOS. Google sign-in is not part of hosted sign-in. Earlier information remains subject to the retention and deletion rules below. See [Google's Privacy Policy](https://policies.google.com/privacy).

### Section 6: initial acceptance table row

Replace only the `Initial acceptance and enrollment record` row:

| Hosted information | Retention and deletion handling |
| --- | --- |
| Initial acceptance and enrollment record | Keep while access is active. Access revocation alone retains the created organization, initial creator agreement metadata, and stable enrollment identifier so repeated signup cannot automatically restore access. Earlier personal-workspace records retain their original schema and purpose. Account deletion receives a separate review of each record and purpose; revocation does not justify indefinite retention. Limit any retained exception to needed evidence or identifiers, with a reason and review date. The record applies to the same WorkOS identity and environment while retained; it does not prevent all future accounts or establish a permanent ban. Deleting this enrollment record can permit a later fresh signup. |

The table header above is context only; do not replace the surrounding table or
any other retention row.

### Section 9: adult and business-use paragraph

Replace the paragraph beginning `Our hosted early-access service is intended for business users aged 18 or older`:

> Our hosted early-access service is intended for business users aged 18 or older. The organization creation agreement requires the creator to confirm the applicable adult, business-use, and organization-authority statements. Invited members do not submit that agreement when joining. Email verification does not verify age or business authority.

This describes what the form records. It does not resolve the owner decision
below about invited members' adult and business-use obligations.

## Checkbox replacement

Replace the whole current `agreement.text`, beginning `By checking this box and selecting Activate free access`:

> By checking this box and selecting Create organization, I agree to the Terms of Service shown above for the organization I am creating and acknowledge that I received and read the Privacy Notice shown above. I confirm that I am at least 18 years old, am legally able to enter this agreement, will use Thermus for business purposes, and have authority to bind this organization.

Keep one checkbox, initially unchecked. Add no invited-member checkbox.

## Owner decisions before approval

- Confirm the organization as the contracting party and the creator’s authority
  statement, including when a person uses a personal email address or creates an
  organization for their own business. Do not infer authority from verification.
- Approve the organization-agreement basis for invited Users and Admins without
  a separate agreement. Decide how the organization’s adult/business-use
  obligations apply to invited members. No application age or authority check is
  added, and no claim is made that existing or invited people already consented.
- Confirm that the unchanged data-processing permissions and privacy legal-role,
  lawful-basis, and international-transfer provisions fit organization use.
  Do not silently add a DPA, processing basis, or new legal role.
- Approve handling of existing users and earlier personal-workspace records under
  the separate transition procedure. This proposal cannot retroactively replace
  their agreements or authorize deleting their replay barriers.
- Confirm the complete revised bytes, versions, hashes, readable presentation,
  exact checkbox, and any effective/publication dates. Approve runtime use,
  publication, transition, and signup opening under their separate scopes.

These are material unresolved terms. This document is a reviewable text proposal,
not completion of the S1-05 legal gate. Provider password-only configuration and
native invitation proofs remain separate release checks; this wording does not
prove that those settings or behaviors are in effect.
