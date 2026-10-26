import { validateSignupDocuments } from './workos-signup-documents.ts';

// Keep this approved successor separate from every frozen earlier bundle.
export const organizationRemovalDocuments = validateSignupDocuments({
  purpose: 'organization-creation',
  version: 's2502-organization-removal-proposal-2026-10-26-v1',
  terms: {
    version: 'hosted-terms-organization-removal-proposal-2026-10-26-v1',
    sha256: '164e013e2cbf0889ad5aaaef14aac745acaed01023bc914c7adae1a4bf4ce048',
    text: `# Terms of Service

**Effective date: 26 October 2026.**

The terms for using the Thermus website, guides, waitlist, evaluation materials, and hosted portal and MCP service, including the limits of our security protections.

**Security has limits.** Thermus is designed to help reduce security risks. It cannot guarantee that every prompt injection, data leak, or other threat will be detected or prevented. You remain responsible for your deployment, access controls, and security decisions.

## 1. Who we are and what these terms cover

These Terms of Service are between Thermus AI Inc., located in California, USA (“Thermus,” “we,” “us”), and the person or organization accepting them (“you”). They cover thermus.ai, our public guides, the early-access waitlist, evaluation materials we expressly provide under these terms, and our current hosted portal at https://app.thermus.ai and its authorized endpoint at https://app.thermus.ai/mcp, and the earlier hosted service at https://thermus.onrender.com and https://thermus.onrender.com/mcp. These endpoints provide a Model Context Protocol (MCP) connection used by your chosen AI assistant or client. They also cover replacement URLs for the same hosted services that we expressly identify as subject to these terms. Together, these are the “Services.”

You accept these terms when you expressly agree to them, including by submitting the waitlist form with the notice linking to these terms, or by selecting the agreement checkbox and submitting the hosted organization creation form. Hosted early access is for business use by adults aged 18 or older. You must be legally able to enter into this agreement. To create a hosted organization, you must accept these terms for that organization and confirm that you have authority to bind it.

When self-service organization creation is available, you may request free access with an email that WorkOS reports as verified. Personal and company email addresses are eligible. This route requires no company domain, email allowlist, or proof of employment. Email verification does not verify your age, employment, or authority to act for an organization. You must review the terms and privacy notice presented on the organization creation form and make the statements in its agreement checkbox before submitting it.

Self-service organization creation creates a named organization and gives its creator the first Admin role after creation and access are confirmed. User permits product and MCP access. Admin includes that access and permits viewing members, managing invitations, removing supported ordinary active User and Admin memberships, and managing the organization’s audit export destination. Access remains subject to current organization membership and permissions. Creation does not add you to Thermus’s internal organization. An organization role or invitation does not give you authority to bind an organization to a contract.

Hosted sign-in uses email and password through WorkOS. Signing in, accepting an invitation, or authorizing an MCP client does not itself accept these terms or an updated version of them. An authorized Admin can invite Users and Admins to use the organization’s workspace under the organization’s agreement; Thermus does not ask an invited member to accept a separate agreement when joining. Authentication and MCP authorization alone do not grant product access. If you already have access, signing in or selecting Continue does not itself record agreement to an updated version. Posting these terms does not by itself replace an existing agreement.

A separate customer agreement, order, or data processing agreement that we have actually agreed with you controls to the extent of a conflict within its subject matter. A separate agreement or license supplied with downloaded software or another offering governs that offering and controls if it conflicts with these terms. These terms do not override rights granted by an applicable open-source license. Joining the waitlist does not purchase a subscription or create a right to product access.

## 2. Using Thermus

You may use the public website and guides for lawful purposes. You may use hosted early access for your business or your organization’s business, within the access Thermus grants you. You are responsible for information and URLs you submit and for the permissions needed to submit them and request their processing.

Keep your sign-in account, devices, browser sessions, and MCP client credentials secure. Use only accounts and client connections you are authorized to use. Do not share credentials in a way that gives another person access they are not permitted to have. Tell us promptly at legal@thermus.ai if you become aware of unauthorized use of your Thermus access. Sign out of the portal and disconnect clients when they are no longer needed. If you need authorization or access revoked, contact legal@thermus.ai. Portal sign-out and client disconnection are separate actions, as explained in section 9.

An organization administrator must have authority to invite members and assign either available invitation role. Administrators are responsible for assigning appropriate access and removing access that is no longer needed. An authorized Admin can use Members to remove supported ordinary active User and Admin memberships, subject to the safeguards in section 9. The portal does not change an existing member’s role. Contact legal@thermus.ai for removal requests outside that supported scope or for an uncertain result. An organization role or invitation does not give a person authority to bind the organization to a contract. Each user must stay within their assigned permissions; WorkOS authentication alone does not grant a Thermus role.

You must not use the Services to gain unauthorized access to systems or data, violate another person’s rights, distribute malicious content, disrupt the Services, or evade access restrictions. Submit a URL only when you are permitted to have Thermus fetch and process the page for your intended use. Do not use the service to bypass a paywall, authentication requirement, or other access restriction.

Do not put passwords, API keys, or other access secrets in submitted URLs, search queries, or request reasons. If an organization Admin enables audit export, exported copies can include submitted URLs, search queries, reasons, and returned content. Redaction does not remove every secret or confidential value. Other operational or error logs can also contain personal information. Do not submit confidential or sensitive personal information through the waitlist. For initial hosted use, request only public or otherwise authorized, non-confidential pages. Do not submit confidential business information, sensitive personal information, or regulated data in URLs, search queries, or request reasons, or request pages containing such data. These limits do not prevent you from providing ordinary account details, such as your name and email address, through the account and organization features.

## 3. Early access and availability

The website, waitlist, and hosted early access are free. No payment card is required. These terms authorize no fees, automatic charges, or automatic renewal. We will present any applicable fees and product terms for separate agreement before you purchase a future paid service. Joining the waitlist does not authorize charges.

Early-access and evaluation services or materials may be incomplete, contain errors, change, or be withdrawn. Free access does not provide unlimited capacity; requests may be limited or refused when service capacity or access limits are reached. Waitlist registration does not guarantee an invitation, launch date, particular feature, or future price. You may contact legal@thermus.ai for support. We will make reasonable efforts to help with hosted early-access issues, but provide no service-level agreement or guaranteed uptime, support response time, or continued availability unless we expressly agree to them in writing.

## 4. Security limitations

**Thermus cannot eliminate security risk.** It may miss harmful content or requests, remove legitimate content, or produce incomplete or incorrect output. No filter detects every attack. Review returned content and consequential actions, and keep other security controls in place.

The hosted MCP service provides page fetching and web search. The page-fetch tool accepts a URL and a reason, fetches and renders the page, cleans the HTML, converts it to Markdown, and returns the result to the requesting MCP client. The search tool accepts a query and a reason, sends the query to Brave Search through a browser renderer, cleans the search-results HTML, converts it to Markdown, and returns the result to the requesting MCP client. Search results can be withheld when processing cannot release them. Cleaning runs on Thermus’s hosted servers. These tools do not provide a general chat or file-upload service. Cleaning can miss prompt injection or other harmful content and does not make a page, search result, or output safe for every use.

Thermus processes only requests sent to it. Other tools, connectors, browser access, code execution, email, and network paths may bypass it. You are responsible for evaluating suitability, configuring and testing your use, managing permissions, maintaining backups and other security controls, and reviewing consequential actions.

Our guides provide general information. They are not a security audit, a compliance certification, or a guarantee that a configuration is appropriate for your environment. Do not rely on Thermus as your sole safeguard, including for activities where failure could cause death, personal injury, or serious harm.

## 5. Content and ownership

Thermus and its licensors retain ownership of the Services and their intellectual property. You may read, copy, and share our public guides, including with an AI assistant, for evaluation and internal business use. Keep attribution and proprietary notices intact. This permission does not grant rights to use our branding to imply endorsement or to redistribute software outside its applicable license.

You retain any rights you have in information you submit, including URLs, search queries, and request reasons. You permit us to process that information to operate the Services and respond to you, including to fetch a submitted URL or send a query to the search provider, render and clean the page or search results, convert them to Markdown, and return the result to your chosen MCP client. This permission also covers keeping operational records and, when your organization Admin enables it, exporting copies of supported tool inputs, public results or errors, and administration events to the organization’s chosen audit Collector or supported OTLP service, as described in our [Privacy Policy](https://thermus.ai/privacy/). An Admin must have authority to select that destination and send the organization’s information to it. The organization is responsible for its destination’s access, retention, and onward sharing. Audit export is best effort; events can be lost or duplicated, and Thermus provides no audit history or replay. We use hosted request information and fetched content only to operate and secure the service, provide support, and meet legal obligations. We do not sell that information or content, use it for advertising targeting, or use it to train models. It does not transfer ownership of your information to us.

You must have the rights or other permission needed for the processing and use you request. Content from a fetched page remains subject to its owner's rights and applicable terms or licenses. Thermus does not grant ownership of third-party content or additional permission to use or distribute it. You are responsible for your use of returned content, including what you send to an MCP client or another service.

You may voluntarily provide feedback, which we may use to improve Thermus without an obligation to compensate you. Do not include confidential information in feedback.

Third-party and open-source materials remain subject to their own licenses. These terms do not override rights those licenses give you.

## 6. Privacy and third parties

Our [Privacy Policy](https://thermus.ai/privacy/) explains how the Services handle personal information, including hosted sign-in, organization access, requests, and operational logs. These terms do not waive our obligations under applicable privacy or data protection laws. An applicable data processing agreement controls its own subject matter as stated in section 1.

WorkOS supports hosted identity, sessions, organization access, and MCP client authorization. Hosted sign-in uses email and password. Render hosts the hosted service. Supabase stores audit destination settings, including encrypted optional credentials, and the current operation record used to control membership removal. An organization’s selected Collector or supported OTLP service receives its audit export and optional synthetic Test events. Direct Axiom export also sends the saved optional dataset name as a routing header. Their roles in handling data are described in the Privacy Policy.

When you request a page, the target site and its page dependencies receive network requests from the hosted service. When you search, Brave Search receives the query and network requests from the hosted renderer; services that provide search-page dependencies can also receive network requests. Thermus returns the resulting page or search-results Markdown to the MCP client you chose. That client and its provider handle the result under their own terms, settings, and policies. Review them before connecting a client or requesting content. The client's subsequent processing can differ from Thermus's processing.

The Services may also link to third-party tools, documentation, or services. Your use of those services is subject to their terms and policies. We do not control their availability or operation. If you paste a guide into an AI assistant, that provider processes what you send under its own terms.

## 7. Disclaimer of warranties

**Use the Services at your own risk, subject to the rights and obligations that applicable law preserves.** Except for commitments expressly made in an applicable agreement or required by law, the Services are provided **“as is” and “as available.”** We do not guarantee that they will always be safe, secure, accurate, error-free, or uninterrupted, or that they will detect or prevent every security incident.

To the extent permitted by applicable law, Thermus disclaims warranties and conditions, whether express, implied, or statutory, including merchantability, fitness for a particular purpose, title, and non-infringement. This disclaimer does not remove any warranty or other right that cannot legally be excluded.

## 8. Limitation of liability

Subject to the exceptions below and to the extent permitted by applicable law, Thermus will not be liable for lost profits or revenues, or indirect, consequential, special, incidental, exemplary, or punitive damages arising from the Services or these terms, even if advised that such damages were possible.

Subject to the same exceptions, Thermus’s total cumulative liability for all claims arising from the Services or these terms will not exceed the greater of **US$100** or the fees you paid Thermus for the Services giving rise to the claim during the 12 months immediately before the event giving rise to it. A separate product agreement may provide a different cap for that product.

These limits apply regardless of whether a claim arises in contract, tort, or otherwise. **They do not exclude or limit liability for fraud, willful misconduct, gross negligence, or any liability that applicable law does not allow us to exclude or limit.** Nothing in these terms restricts mandatory consumer rights or other non-waivable legal protections.

## 9. Ending use

You may stop using the Services at any time. You can sign out of the portal, disconnect an MCP client using that client’s controls, and ask to leave the waitlist by emailing legal@thermus.ai. Portal sign-out and client disconnection are separate actions. Disconnecting a client may remove credentials from that client without revoking all authorization or deleting service records. An authorized Admin can use Members to remove a supported ordinary active User or Admin membership, including their own, when another usable active Admin remains. A pending invitation does not count as an active Admin. Removal deletes only the selected organization membership. The person’s account, memberships in other organizations, and existing personal factors remain. Return to that organization requires a new authorized invitation; old grants are not restored. Directory-managed or unknown-management memberships and unsupported grants require a separate authorized process. If a removal result is not confirmed, it may have taken effect: do not submit another removal. Refresh shows current access and does not settle that operation. Contact legal@thermus.ai for help with an uncertain result or a request outside the supported scope. Do not assume that any of these actions immediately invalidates every issued token. Contact legal@thermus.ai to request connection or access revocation, or with account or deletion requests. These actions and requests do not by themselves delete retained operational records or all records held by identity or hosting providers. We may retain a limited signup agreement and workspace record after access is removed to show the initial agreement and prevent repeat signup from restoring removed access, as described in the Privacy Policy. This record is not a complete history of agreements or account activity.

After verifying a request and the requester’s authority, we will promptly revoke the access covered by an authorized closure or removal request. We aim to complete deletion actions within our control within 30 calendar days after receiving the request, subject to identity and authority verification. Verification does not extend a deadline imposed by law, and faster legal requirements apply. This target does not guarantee that all provider residual records or backups are erased within 30 days. The Privacy Policy explains retained records, provider limits, and related requests.

We may restrict or suspend access when reasonably necessary to address misuse, a security risk, a material breach of these terms, or a legal requirement. Where practical, we will give notice and an opportunity to resolve the issue. Any applicable customer agreement controls additional termination rights and obligations within its scope.

The provisions about ownership, warranty disclaimers, liability, and resolving disputes continue after use ends to the extent needed to give them effect. Personal information remains subject to the Privacy Policy and applicable law.

## 10. Changes and governing law

California law governs these terms, excluding its conflict-of-laws rules, except where mandatory law requires otherwise. Disputes may be brought in the state or federal courts with jurisdiction in California, subject to any mandatory right you have to bring a claim elsewhere.

We may update these terms by posting a revised version and date here. For material changes affecting an existing agreement, we will provide appropriate notice and obtain renewed agreement where required. Changes do not apply retroactively to disputes that arose before the change.

If a provision is unenforceable, the remaining provisions continue to apply. A failure to enforce a provision is not a waiver. These terms govern their stated subject matter without replacing a separate applicable agreement or rights that cannot be waived by contract.

## 11. Contact

Thermus AI Inc.  
California, USA  
[legal@thermus.ai](mailto:legal@thermus.ai)

Send legal notices and questions about these terms to this email address.

## 12. About these terms

Adapted from the [Common Paper Terms of Service](https://commonpaper.com/standards/terms-of-service/) and [Cloud Service Agreement Standard Terms, Version 2.1](https://commonpaper.com/standards/cloud-service-agreement/2.1/), by Common Paper, Inc., available under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

We modified the scope, access and ownership provisions, warranty disclaimers, liability limits, and general terms for Thermus, and added the security limitations above. Subscription, payment, and other provisions that do not apply to these Services have been omitted. This page contains the adapted terms in full; it does not incorporate the unmodified Common Paper agreement or imply Common Paper’s endorsement.
`,
  },
  notice: {
    version: 'hosted-privacy-organization-removal-proposal-2026-10-26-v1',
    sha256: 'df330cf3d905f4bd6f64d3a9dfd8dded5be476c39e40e05b87596e6678429b1c',
    text: `# Privacy Policy

**Effective date: 26 October 2026.**

How Thermus handles information from our website, contact form, waitlist, public product guides, hosted portal, and hosted MCP service.

**The essentials:** We collect contact-form details and messages, waitlist information, and website information as described below. Our hosted service also processes sign-in and organization information, agreement records, the URLs, search queries, and reasons submitted through your MCP client, fetched pages and search results, and service logs. We fetch a requested page or send your search query to Brave Search, clean the returned HTML, and return Markdown to your chosen client. The defined tool-completion and pipeline-step operator records omit submitted URLs, search queries, reasons, and returned content. Other operational, error, and provider logs have separate behavior. If your organization Admin enables audit export, copies of supported tool inputs, public results or errors, and administration events are sent to its selected Collector or supported OTLP service. Supabase stores destination settings and the current membership-removal operation record; Thermus holds pending audit events only in bounded process memory, with no audit history or replay. Redaction is pattern-based and does not remove every secret or confidential value. Delivery can lose or duplicate events. You can request access, correction, or deletion by emailing [legal@thermus.ai](mailto:legal@thermus.ai).

## 1. Who we are and scope

Thermus AI Inc., located in California, USA (“Thermus,” “we,” “us”), handles the personal information described in this policy. This policy covers thermus.ai, the contact form, the early-access waitlist, our public product guides, communications about them, and our current hosted portal at https://app.thermus.ai and service at https://app.thermus.ai/mcp, and the earlier hosted service at https://thermus.onrender.com and https://thermus.onrender.com/mcp. The service uses Model Context Protocol (MCP) to let your chosen AI assistant or other client request pages. Hosted coverage includes sign-in, signup, organization administration, page-fetch and search requests, service logs, and optional organization audit export.

This policy describes the hosted service that Thermus operates. It does not describe how a customer operates its own deployment. The hosted Terms of Service address your use of our service; this notice describes our information handling. Third-party websites, identity services, AI assistants or other MCP clients, and the organization’s selected audit Collector or supported OTLP service have their own privacy policies.

## 2. Information we collect

### Waitlist and communications

When you join the waitlist, we collect your email address and which website button opened the form. Our form provider also processes submission metadata, such as the submission time and network information, to receive the submission and filter spam. If you email us, we receive your address and the information you include in your message.

When you use the contact form, we collect your name, email address, optional company, selected topic, and message. Netlify stores the submission and processes submission metadata for spam filtering. A notification copy is sent to our contact mailbox so we can respond. Contacting us does not subscribe you to the waitlist or marketing emails; we use your details to reply.

Please do not send passwords, API keys, sensitive personal information, or confidential business data through either form.

### Website requests and analytics

Our hosting, delivery, and security providers process technical information needed to serve the website, such as IP addresses, requested URLs, browser or user-agent information, timestamps, and response details. Cloudflare Web Analytics provides website usage and performance measurements, such as page views and loading times. Netlify Real User Monitoring also measures page loading, responsiveness, and visual stability based on visits to the production site.

### Copied guides and topic requests

Each time you copy the starter guide, it includes a random identifier in its topic links. We record a successful copy notification and requests to those links, including the identifier, requested topic, guide version, time, request method and status, request identifier, network address reported by our host, and user-agent information.

The identifier groups requests made from the same copied guide. It does not identify a verified person or account, and a shared guide keeps the same identifier. A request made by an AI assistant may show the assistant provider’s network information instead of yours; an intermediary may also appear in network logs.

These guide events do not include the contents of your chat, prompts, company documents, or waitlist email. The event logger does not record request bodies, cookies, query strings, or referrer headers. Hosting providers may separately retain ordinary request logs. These guide-event limits do not describe hosted service logs.

### Hosted accounts, sign-in, and organizations

We use WorkOS AuthKit for hosted sign-in. Hosted sign-in uses email and password. Google sign-in is not part of hosted sign-in. This change does not delete identity information retained from earlier Google sign-ins. The earlier Google sign-in requested the identity scopes \`openid\`, \`email\`, and \`profile\`, not access to Gmail, Google Drive, or Google Calendar content.

We process the WorkOS user identifier, email address, name, email verification status, selected organization, authentication method, and session and authentication information. The encrypted browser session can contain the user profile returned by WorkOS, including identifiers, name, email and verification status, and, when supplied, profile image, locale, account or sign-in timestamps, external identifiers, and account metadata. It also contains the selected organization, WorkOS access and refresh tokens, authentication method, and any impersonation information returned by WorkOS. The portal uses security values to protect access. The portal does not use multi-factor authentication status as an application access requirement. These WorkOS session credentials are distinct from Google identity data.

WorkOS stores organization memberships, roles, and invitations. We read this information to check access and send authorized invitations, invitation changes, and exact-membership deletions to WorkOS. User permits product and MCP access. Admin includes that access and permits viewing members, managing invitations, removing supported ordinary active User and Admin memberships, and managing the organization’s audit export destination. The portal does not change an existing member’s role. Removal requires another usable active Admin to remain; a pending invitation does not count. Directory-managed or unknown-management memberships and unsupported grants are outside this removal action. Removal deletes only the selected organization membership and preserves the underlying account, other organization memberships, and existing personal factors. Rejoining requires a new authorized invitation and does not restore old grants. A result that is not confirmed may have taken effect. A refresh shows current access and cannot settle that operation; do not submit another removal. Authorized organization administrators can see member or invitee email addresses, roles, and status.

When you connect an MCP client, WorkOS Connect handles authorization consent and credentials. Thermus receives and checks the client's bearer token and uses user and organization identifiers to check current access. The MCP client's credentials are separate from the browser's session cookies. Browser workspace selection does not change the workspace in an existing MCP token.

### Signup, agreement, and operator records

For new self-service organization creation, we read your current WorkOS email verification status and record the creator’s initial agreement for the named WorkOS organization. We store the creator’s user identifier, the acceptance time, and the versions of the terms, privacy notice, and agreement wording shown. We also store the organization’s name and an enrollment identifier based on the WorkOS environment and creator’s user identifier, without using the email address. While this record remains, repeated signup cannot automatically create or restore access. Invited Users and Admins do not create a separate signup agreement record when joining. Earlier personal-workspace records retain their original purpose.

We retain the exact versioned terms, privacy notice, and agreement wording separately so that the recorded versions and hashes can be checked against the text shown. The WorkOS record identifies the initial self-service acceptance. The notice version records the notice shown; it is not a separate consent to all personal-information processing. A saved record can remain after an incomplete activation and does not itself establish that access was granted. It is not a complete history of later agreements and does not show that every existing user accepted these terms. Sign-in and MCP connection consent are separate from acceptance of Thermus terms. Email verification confirms the reported email status; it does not establish that we vetted a person's identity, age, employment, or business authority.

For operator-managed onboarding, recovery, privacy, access-removal, and deletion requests, we keep restricted private records as needed. These can include account identity and email, organization, stated authority, requested scope, relevant agreement and notice versions, exact agreement evidence, dates, checks, actions, outcomes, and reasons and review dates for retained exceptions. We use these records to administer access, show which agreement applies, prevent an uncertain activation from being replayed, handle requests, resolve disputes, and meet legal obligations. Their retention criteria are in section 6.

### Membership-removal operation records

To prevent overlapping or repeated uncertain removals, we store one current operation record per organization in the private Supabase PostgreSQL schema. It contains the organization identifier, operation UUID, exact target membership identifier and revision, actor identity service and user identifier, start time, and a confirmed applied or no-effect outcome when available. The operation record contains no password, token, invitation link, or factor secret. It is separate from audit export and is not an audit history. An unresolved record holds further removals for that organization without an automatic expiry, including after a restart. Current membership reads cannot clear that hold. An export failure does not change the removal outcome or release the hold. The retention criteria are in section 6.

### Hosted page fetches and web searches

Your MCP client sends Thermus a URL and a reason for fetching it. The page-fetch tool accepts these fields; it is not a general chat transcript or file upload service. Thermus sends the full submitted URL to a browser renderer, fetches and renders the page, cleans the HTML, converts it to Markdown, and returns the result to your requesting MCP client. Cleaning attempts to remove advertisements and potential prompt injection. The reason can be included in the organization’s enabled audit export; it is not sent to the renderer as a separate field.

Destination websites and services that provide page dependencies can receive request paths, query parameters, and network information when the renderer requests content. HTTP requests do not send URL fragments. Your client receives the resulting Markdown and handles it under its own policies and settings.

The search tool receives a text query and a reason from your MCP client. Thermus validates both fields and sends the query as a URL query parameter to Brave Search’s public search page through its hosted browser renderer. The reason is not sent to the renderer or Brave Search as a separate field. Thermus cleans the search-results HTML, converts it to Markdown, and returns the result to your requesting MCP client. Search processing can withhold results when scanning fails or reaches a limit. An empty search can return a no-results message. Your client handles the output under its own policies and settings.

Brave Search receives the search query and network information from the renderer’s requests. Services that provide search-page dependencies can also receive network requests. The search tool does not itself fetch each listed result page; a separate page-fetch request can retrieve one.

### Hosted service logs and technical information

The defined page-fetch and search tool-completion operator records contain the identity service, user identifier, organization or tenant identifier, operation identifier, tool name, outcome, and duration. They omit submitted URLs, search queries, reasons, and returned content. Pipeline-step logs contain the operation identifier, step identifier, outcome, fixed code when applicable, and duration; they omit request and result content. These omissions apply to these defined records; they are not a promise that all other systems or logs omit those fields. URL paths, queries, and reasons can contain personal or confidential information.

Organization change logs record the actor identifiers, organization, target membership or invitation identifier or email address, action, role, time, and outcome. The service also produces operational and error logs. Error details can contain personal information. Our hosting service receives network and request information, including request headers and the immediate network peer address.

### Organization audit export and destination settings

An organization Admin can choose Axiom or a Custom HTTPS OTLP/HTTP JSON logs destination, provide a Bearer credential, and save the export enabled state. Axiom requires a dataset name; Custom uses no Axiom dataset. The portal requires a new token when none is saved or the endpoint changes. A blank token keeps the saved Bearer credential for the same endpoint. The portal has no unauthenticated-delivery or token-removal option. We store the organization identifier, destination address, optional dataset name, authentication choice, enabled state, revision, and encrypted optional credential in a private PostgreSQL schema hosted by Supabase. For direct Axiom export, the application sends the saved dataset name in the x-axiom-dataset routing header. The application uses the credential to authenticate delivery; the dataset routing header and credential are not fields of the audit event payload. Authorized Admins can read the saved destination and optional dataset name and whether a credential is present. The portal can show the first four characters followed by masking when the saved token is longer than four characters; it does not display the full saved credential.

When export is enabled, supported tool events can include the validated fetch URL and reason or search query and reason, together with the final public result or error text returned to the MCP client. They also include trusted organization and actor identifiers, operation identifier, tool, outcome, duration, and time. A captured fetch URL can include noncredential query parameters and fragments. Invitation send, resend, and revoke events include the actor, organization, target email address or invitation identifier, role where applicable, action, outcome, and time. Membership-removal events include the actor, organization, exact target membership identifier, action, outcome, and time; their payloads exclude the form token and membership revision. Audit destination Save and Test events include action and outcome metadata; those event payloads exclude the saved endpoint, dataset name, and credential. These exports are separate from internal operator logs. Supported audit events and synthetic Test events can also include the actor’s display name when available. Names are display metadata; stable actor identifiers remain. Thermus trims and bounds names and applies the same pattern-based redaction to them. Missing or invalid names are omitted.

Before export, Thermus replaces recognized credential fields and selected credential-bearing URL parameters. This redaction uses patterns; it does not remove every secret, personal detail, or confidential value. Sign-in form fields, session cookies, request Authorization headers, and the saved destination credential are not collected as audit event fields. Information repeated in tool inputs or returned text can still be captured. The existing restrictions on submitting secrets, confidential information, sensitive personal information, and regulated data still apply.

Exported result text is limited to 65,536 bytes; the serialized captured event is limited to 131,072 bytes. A truncated exported result copy includes a [TRUNCATED] marker and original and captured byte counts. These capture limits do not shorten the result returned to your MCP client. Unsupported or invalid captures can be omitted.

The optional Test action first saves the submitted destination settings, including the export enabled state, then attempts to send one synthetic event for that saved destination revision, including organization and actor identifiers, time, and the revision. Test can run while export is disabled. Save and Test each apply the Enable export switch state, so either action can enable or disable export. If Save fails or is not confirmed, no Test is sent. A Test failure or uncertain result does not roll back saved settings. A Test event may have reached the destination even if its result cannot be confirmed. Test proves neither future delivery nor durable receipt or storage. Pending export events remain only in bounded process memory. Delivery is best effort: overload, expiry, disable, changed settings, outages, or shutdown can drop events; retries can produce duplicates. Thermus provides no audit event history or replay. Your organization controls the destination and its retention, access, and onward sharing.

## 3. How we use information

- **Early access:** maintain the waitlist and contact you about early access, as requested when you sign up.
- **Website operation:** deliver pages and guides, troubleshoot failures, maintain security, and prevent abuse or spam.
- **Understanding interest:** measure website performance and which guide topics are requested so we can improve the site and documentation.
- **Responding to you:** answer questions, handle privacy requests, and meet applicable legal obligations.
- **Hosted access:** sign you in, record agreement, maintain sessions, check access, manage organization membership and invitations, and connect authorized MCP clients.
- **Page fetching:** retrieve a requested page, clean and convert it, and return the result to the requesting client.
- **Web search:** send a submitted query to Brave Search, process its search-results HTML, and return the result to the requesting client.
- **Hosted operation:** record request outcomes and account changes, prevent overlapping or repeated uncertain removals, diagnose failures, handle activation recovery and access removal, and support service security and administration.
- **Organization audit export:** store the organization’s destination settings, send supported events when an Admin enables export, and test the saved destination on request.

For Thermus's own use of hosted information, we use account, agreement, request, and log information only to provide the service, maintain security, respond to support and privacy requests, and meet legal obligations. We do not sell personal information or share it for cross-context behavioral advertising. We do not use hosted account data, submitted URLs, search queries and reasons, fetched content or search results, or service logs to train models. The website does not use advertising pixels to track you across unrelated sites. These commitments describe Thermus's use; providers can separately process their own account, security, and usage information under their policies.

Use the hosted page-fetching service for public pages or other non-confidential pages that you are authorized to retrieve. Do not submit secrets, passwords, API keys, sensitive personal information, or regulated data in URLs, search queries, or reasons, or request pages containing such data. Ordinary account information, such as your name and email address, is needed for access and is permitted.

## 4. Service providers and sharing

We use providers to operate the website and handle information for the purposes above:

- **Netlify:** website hosting, waitlist and contact form storage, spam filtering and email notifications, request and guide-event logs, and performance measurements through Real User Monitoring. See [Netlify’s Privacy Statement](https://www.netlify.com/privacy/) and its [Real User Monitoring documentation](https://docs.netlify.com/manage/monitoring/real-user-monitoring/).
- **Cloudflare:** website delivery, security, and Web Analytics. See [Cloudflare’s Privacy Policy](https://www.cloudflare.com/privacypolicy/) and its [Web Analytics documentation](https://developers.cloudflare.com/web-analytics/about/).
- **Communications providers:** email services used to receive your messages and send early-access or service communications.

We use these providers to operate the hosted service. They process information needed for their respective functions:

- **Render:** hosts the application and processes service traffic and operational logs. The production application sends completion, account-change, and other service log records to its logging output on Render. See [Render's Privacy Policy](https://render.com/privacy).
- **WorkOS:** provides sign-in, identity and session services, organization membership and invitation management, signup acceptance-record storage, and Connect authorization consent and token services. See [WorkOS's Privacy Policy](https://workos.com/legal/privacy).
- **Supabase:** hosts the private PostgreSQL schema for organization audit destination settings, including the optional Axiom dataset name, revisions, enabled state, and encrypted optional credentials, and the current membership-removal operation record described in section 2. Thermus stores no audit event history in that schema. See [Supabase’s Privacy Policy](https://supabase.com/privacy).
- **Brave Search:** receives search queries and network information through requests from the hosted browser renderer to its public search page. Thermus receives and processes the returned search-results HTML. Brave Search handles information it receives under its own policies.
- **Google:** processed Google sign-in when that method was used and provided identity information through WorkOS. Google sign-in is not part of hosted sign-in. Earlier information remains subject to the retention and deletion rules below. See [Google's Privacy Policy](https://policies.google.com/privacy).

Other recipients arise from the requests you choose to make:

- **Requested websites and their dependencies:** can receive request paths, query parameters, and network information needed to fetch and render content.
- **Your chosen MCP client:** sends requests and receives the returned Markdown. Its provider can handle that information under its own policies and your settings.
- **Your organization’s selected audit destination:** a Collector or supported OTLP service receives the supported audit events when export is enabled, and synthetic Test events when an Admin requests Test, including while disabled. Review that destination’s settings and policies, including retention, access, and onward sharing. This includes Axiom when your Admin configures direct Axiom export. For that export, Axiom receives the dataset name as a routing header and the configured Bearer credential for authentication, as well as the event. The destination’s handling can differ from Thermus’s handling.

Authorized organization administrators also receive the member and invitation information described in section 2. Thermus personnel who handle service administration, recovery, support, or privacy requests can access information needed for those tasks.

Information may also be disclosed when reasonably necessary to comply with law, respond to valid legal process, protect rights and security, or complete a merger, acquisition, or transfer of the business, subject to applicable privacy requirements.

If you paste a guide into ChatGPT, Claude, or another assistant, you choose what to share with that provider. Its handling of your conversation is governed by its own policies. Requests it makes to our guide links are logged as described above.

## 5. Cookies and tracking choices

Our waitlist and guide-copy features do not store your email or guide identifier in cookies or browser storage. Cloudflare states that its Web Analytics does not use cookies or local storage for analytics, and Netlify states that Real User Monitoring does not require browser cookies. Hosting and security services may use necessary cookies when a security feature requires them.

The contact form keeps your draft only in the current page. It does not save contact details or messages in cookies or browser storage, or send those fields to website analytics or application logs.

You can read the [complete guide](https://thermus.ai/thermus.md) or follow its ordinary topic links without a per-copy identifier. Those requests can still appear in ordinary hosting logs. Browser settings can block cookies or analytics scripts; blocking them does not necessarily prevent server-side request logging.

### Necessary hosted sign-in cookies

The hosted portal uses encrypted cookies needed for sign-in and sessions:

| Cookie | Purpose | Browser lifetime |
| --- | --- | --- |
| \`__Host-thermus-sign-in\` | Holds temporary sign-in state, a code verifier, return destination, and expiry time to complete sign-in securely. | Up to 10 minutes. |
| \`__Host-thermus-session\` | Holds the encrypted WorkOS session described in section 2, including profile data, access and refresh tokens, and security information. | 30 days; this can renew when the session refreshes. WorkOS can end a session earlier. |

Both cookies use Secure, HttpOnly, and SameSite=Lax settings. Blocking them can prevent hosted sign-in. The MCP client holds its own credentials separately. These cookie lifetimes do not state how long WorkOS, Render, Google, or another recipient retains records.

The site does not currently change its request logging in response to a browser’s “Do Not Track” signal. We do not sell or share information for cross-context behavioral advertising, including when a Global Privacy Control signal is present. Where applicable law requires us to honor an opt-out signal, we will do so.

## 6. Retention and security

We retain waitlist information while it is needed to manage early access and communicate with you, unless you request deletion or a longer period is required by law. We retain correspondence as needed to respond to you, resolve issues, and meet legal obligations. Retention decisions take account of the purpose, sensitivity, and any legal requirements.

Contact correspondence includes both the submission stored by Netlify and the notification and replies in our mailbox. Retention and deletion requests cover both copies, subject to the purposes and legal obligations above.

Website and guide logs follow the retention settings and periods of the relevant hosting or analytics provider. Network addresses in request logs are not necessarily anonymized. Backup and security records may remain until their normal retention periods expire.

The current hosted page-fetch and search-result processing paths do not use an application content database, persistent content cache, or model API to process fetched pages or search results. Page and search-result content is processed to return the requested result; this does not guarantee immediate or secure deletion from memory, temporary processing resources, or recipients' systems. Browser sessions, identity and organization records, acceptance and operator records, service logs, and records held by recipients are separate from page processing. Optional audit export can send a bounded copy of returned content to the organization’s selected destination as described in section 2; the application content-database statement does not describe the destination’s storage.

We retain active account and access records while needed to provide your access. When we receive a closure request, we promptly address access removal and revocation of relevant sessions and client authorizations, subject to verification of identity and authority. Our target is to complete deletion actions that Thermus is authorized and able to perform within 30 calendar days of receiving the request, or sooner if applicable law requires. Verification does not extend a statutory deadline. We may retain specific records where needed for a legal obligation, an applicable agreement or dispute, or a documented security or access-control purpose. We limit retained information to the purpose, record the reason and a review date, and delete it when the reason ends, subject to applicable obligations. We will explain an applicable exception when we respond to your request. This is not a promise that all provider records or backups are erased within 30 days.

| Hosted information | Retention and deletion handling |
| --- | --- |
| Accounts, organizations, memberships, and client authorizations | Keep while needed for active access. Account, membership, and authorization deletion are separate actions. Membership removal alone does not delete the underlying user or unrelated organization access. Apply the operator-action target above to authorized deletion actions. |
| Initial acceptance and enrollment record | Keep while access is active. Access revocation alone retains the created organization, initial creator agreement metadata, and stable enrollment identifier so repeated signup cannot automatically restore access. Earlier personal-workspace records retain their original schema and purpose. Account deletion receives a separate review of each record and purpose; revocation does not justify indefinite retention. Limit any retained exception to needed evidence or identifiers, with a reason and review date. The record applies to the same WorkOS identity and environment while retained; it does not prevent all future accounts or establish a permanent ban. Deleting this enrollment record can permit a later fresh signup. |
| Exact documents, agreement wording, and operator records | Keep the exact versioned terms, notice, and agreement wording so initial and separately recorded agreements can be understood. Keep personal acceptance, recovery, privacy-request, and deletion evidence while needed for access, an applicable agreement, a dispute, security, or legal duties. Review need at closure and when a related issue ends. Delete personal information when no longer needed, subject to applicable obligations. |
| Invitations | Current invitation validity is 7 days. Expiry does not establish deletion of the invitation or delivery records. Cancel invitations no longer needed when closing access and request record deletion where available under the operator-action target above. WorkOS may retain separate operational, security, or legal records. |
| Service completion, organization-change, operational, and error logs | Render's current plan provides 7 days of accessible application log history. We keep this setting and avoid routine operator-log exports or extra operator-log stores. No Render log-stream destination is currently configured. Organization audit export is a separate stream. Specific security or legal evidence can be retained with a reason and review date. The history window does not establish physical erasure after 7 days or govern provider-managed security, compliance, or backup copies. |
| Membership-removal operation record | Keep the current record to control safe removal. An unresolved record has no automatic expiry and must not be removed merely because time passed or a current membership read changed. A proved terminal record can be replaced by the next admitted operation for that organization; this is not a complete history. At closure or on an authorized deletion request, review the remaining safety, dispute, and legal need. Limit any retained exception to necessary evidence or identifiers, record a reason and review date, and delete it when that need ends, subject to applicable obligations. |
| Audit destination settings | Keep while needed for the organization’s audit configuration. Disabling export stops export but does not itself delete the destination or saved credential. Thermus does not make a separate backup of these settings or provide a settings restore service. If settings or their encryption key are lost, an Admin may need to re-enter the destination and credential. Authorized deletion requests receive the operator-action review and target above. |
| Pending audit events and destination copies | Thermus holds pending events only in bounded process memory, with no durable queue, history, or replay. Events can expire or be dropped before delivery. Disabling or changing a destination does not recall copies already sent. The selected destination controls retention and deletion of received copies; contact its operator for those copies. |
| Provider backups, archives, security, and legal records | Providers retain residual copies under their applicable schedules and legal requirements. We use applicable provider deletion processes. Residual copies can remain after account or membership deletion; no fixed purge deadline for all provider copies is promised. |

WorkOS currently limits AuthKit sessions to 365 days, with a 48-hour inactivity timeout, and sets AuthKit access tokens to 5 minutes. These are validity controls, not deletion periods. They do not state the lifetime of MCP Connect tokens or provider records. Browser cookie lifetimes are in section 5.

Signing out, disconnecting a client, or revoking access does not itself delete provider records, service logs, or backups. These actions do not guarantee that every previously issued token becomes invalid at once. Closing a Thermus account does not delete your Google account or copies held by a requested website or your chosen MCP client. The organization’s selected audit destination also retains copies already delivered under its own rules. Those services apply their own retention and deletion rules. See [Google's retention explanation](https://policies.google.com/technologies/retention).

No internet transmission or storage system can be guaranteed completely secure. This does not remove our obligations to protect personal information under applicable law.

## 7. Your choices and rights

You can ask to leave the waitlist, stop early-access emails, access or correct your information, or delete it by emailing [legal@thermus.ai](mailto:legal@thermus.ai). You can also use an unsubscribe option when one is provided in an email.

For the hosted service, you can sign out of the portal. Your MCP client may provide disconnect controls; these may only remove credentials held by that client. You can contact legal@thermus.ai to request connection or account access revocation. Signing out or disconnecting does not itself request deletion of retained information. To request access, correction, export, or deletion of hosted information, contact legal@thermus.ai and identify your account email and organization, if relevant. Do not send passwords or tokens.

Depending on where you live and which laws apply, you may have rights to obtain a copy of your information, request portability, restrict or object to processing, withdraw consent, appeal a decision about a request, or complain to a privacy regulator. California residents may have rights to know, access, correct, and delete personal information and to receive equal treatment when exercising applicable privacy rights.

We may need information to verify a request and your authority to make it. We will respond as required by applicable law and explain any applicable exception. Please send only what is needed to identify your request, such as the email used for the waitlist or your hosted account.

## 8. International visitors

Thermus is based in the United States. Our providers operate internationally, so information may be processed in the United States and other countries with different data protection laws. Where transfer safeguards are legally required, we must use an applicable transfer mechanism or other lawful basis; using the website or hosted service does not waive those protections.

For our website, waitlist, and public guides, where European or UK data protection law applies, we rely, as appropriate, on your consent for requested early-access communications, our legitimate interests in operating and securing the site and understanding its use, and compliance with legal obligations. You may withdraw consent or object to processing as described above. Contact us for information about the safeguards applicable to your information.

## 9. Children

The website is intended for a business audience and is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided information, contact us so we can investigate and delete it as appropriate.

Our hosted early-access service is intended for business users aged 18 or older. The organization creation agreement requires the creator to confirm the applicable adult, business-use, and organization-authority statements. Invited members do not submit that agreement when joining. Email verification does not verify age or business authority.

## 10. Changes and contact

We will post updates to this policy on this page and identify the effective and update dates. If a change materially affects how we handle information already collected, we will provide additional notice and obtain consent where required by law.

For privacy questions or requests, contact:

**Thermus AI Inc.**  
California, USA  
[legal@thermus.ai](mailto:legal@thermus.ai)
`,
  },
  agreement: {
    version: 'hosted-agreement-organization-proposal-2026-10-23-v2',
    text: `By checking this box and selecting Create organization, I agree to the Terms of Service shown above for the organization I am creating and acknowledge that I received and read the Privacy Notice shown above. I confirm that I am at least 18 years old, am legally able to enter this agreement, will use Thermus for business purposes, and have authority to bind this organization.
`,
  },
});
