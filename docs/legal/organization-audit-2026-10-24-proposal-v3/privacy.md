# Privacy Policy

**Effective date: 24 October 2026.**

How Thermus handles information from our website, contact form, waitlist, public product guides, hosted portal, and hosted MCP service.

**The essentials:** We collect contact-form details and messages, waitlist information, and website information as described below. Our hosted service also processes sign-in and organization information, agreement records, the URLs, search queries, and reasons submitted through your MCP client, fetched pages and search results, and service logs. We fetch a requested page or send your search query to Brave Search, clean the returned HTML, and return Markdown to your chosen client. The defined tool-completion and pipeline-step operator records omit submitted URLs, search queries, reasons, and returned content. Other operational, error, and provider logs have separate behavior. If your organization Admin enables audit export, copies of supported tool inputs, public results or errors, and administration events are sent to its selected Collector or supported OTLP service. Supabase stores destination settings; Thermus holds pending audit events only in bounded process memory, with no audit history or replay. Redaction is pattern-based and does not remove every secret or confidential value. Delivery can lose or duplicate events. You can request access, correction, or deletion by emailing [legal@thermus.ai](mailto:legal@thermus.ai).

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

We use WorkOS AuthKit for hosted sign-in. Hosted sign-in uses email and password. Google sign-in is not part of hosted sign-in. This change does not delete identity information retained from earlier Google sign-ins. The earlier Google sign-in requested the identity scopes `openid`, `email`, and `profile`, not access to Gmail, Google Drive, or Google Calendar content.

We process the WorkOS user identifier, email address, name, email verification status, selected organization, authentication method, and session and authentication information. The encrypted browser session can contain the user profile returned by WorkOS, including identifiers, name, email and verification status, and, when supplied, profile image, locale, account or sign-in timestamps, external identifiers, and account metadata. It also contains the selected organization, WorkOS access and refresh tokens, authentication method, and any impersonation information returned by WorkOS. The portal uses security values to protect access. The portal does not use multi-factor authentication status as an application access requirement. These WorkOS session credentials are distinct from Google identity data.

WorkOS stores organization memberships, roles, and invitations. We read this information to check access and send authorized invitations and invitation changes to WorkOS. User permits product and MCP access. Admin includes that access and permits viewing members, managing invitations, and managing the organization’s audit export destination. The portal does not provide member removal or changes to an existing member’s role. Authorized organization administrators can see member or invitee email addresses, roles, and status.

When you connect an MCP client, WorkOS Connect handles authorization consent and credentials. Thermus receives and checks the client's bearer token and uses user and organization identifiers to check current access. The MCP client's credentials are separate from the browser's session cookies. Browser workspace selection does not change the workspace in an existing MCP token.

### Signup, agreement, and operator records

For new self-service organization creation, we read your current WorkOS email verification status and record the creator’s initial agreement for the named WorkOS organization. We store the creator’s user identifier, the acceptance time, and the versions of the terms, privacy notice, and agreement wording shown. We also store the organization’s name and an enrollment identifier based on the WorkOS environment and creator’s user identifier, without using the email address. While this record remains, repeated signup cannot automatically create or restore access. Invited Users and Admins do not create a separate signup agreement record when joining. Earlier personal-workspace records retain their original purpose.

We retain the exact versioned terms, privacy notice, and agreement wording separately so that the recorded versions and hashes can be checked against the text shown. The WorkOS record identifies the initial self-service acceptance. The notice version records the notice shown; it is not a separate consent to all personal-information processing. A saved record can remain after an incomplete activation and does not itself establish that access was granted. It is not a complete history of later agreements and does not show that every existing user accepted these terms. Sign-in and MCP connection consent are separate from acceptance of Thermus terms. Email verification confirms the reported email status; it does not establish that we vetted a person's identity, age, employment, or business authority.

For operator-managed onboarding, recovery, privacy, access-removal, and deletion requests, we keep restricted private records as needed. These can include account identity and email, organization, stated authority, requested scope, relevant agreement and notice versions, exact agreement evidence, dates, checks, actions, outcomes, and reasons and review dates for retained exceptions. We use these records to administer access, show which agreement applies, prevent an uncertain activation from being replayed, handle requests, resolve disputes, and meet legal obligations. Their retention criteria are in section 6.

### Hosted page fetches and web searches

Your MCP client sends Thermus a URL and a reason for fetching it. The page-fetch tool accepts these fields; it is not a general chat transcript or file upload service. Thermus sends the full submitted URL to a browser renderer, fetches and renders the page, cleans the HTML, converts it to Markdown, and returns the result to your requesting MCP client. Cleaning attempts to remove advertisements and potential prompt injection. The reason can be included in the organization’s enabled audit export; it is not sent to the renderer as a separate field.

Destination websites and services that provide page dependencies can receive request paths, query parameters, and network information when the renderer requests content. HTTP requests do not send URL fragments. Your client receives the resulting Markdown and handles it under its own policies and settings.

The search tool receives a text query and a reason from your MCP client. Thermus validates both fields and sends the query as a URL query parameter to Brave Search’s public search page through its hosted browser renderer. The reason is not sent to the renderer or Brave Search as a separate field. Thermus cleans the search-results HTML, converts it to Markdown, and returns the result to your requesting MCP client. Search processing can withhold results when scanning fails or reaches a limit. An empty search can return a no-results message. Your client handles the output under its own policies and settings.

Brave Search receives the search query and network information from the renderer’s requests. Services that provide search-page dependencies can also receive network requests. The search tool does not itself fetch each listed result page; a separate page-fetch request can retrieve one.

### Hosted service logs and technical information

The defined page-fetch and search tool-completion operator records contain the identity service, user identifier, organization or tenant identifier, operation identifier, tool name, outcome, and duration. They omit submitted URLs, search queries, reasons, and returned content. Pipeline-step logs contain the operation identifier, step identifier, outcome, fixed code when applicable, and duration; they omit request and result content. These omissions apply to these defined records; they are not a promise that all other systems or logs omit those fields. URL paths, queries, and reasons can contain personal or confidential information.

Organization change logs record the actor identifiers, organization, target membership or invitation identifier or email address, action, role, time, and outcome. The service also produces operational and error logs. Error details can contain personal information. Our hosting service receives network and request information, including request headers and the immediate network peer address.

### Organization audit export and destination settings

An organization Admin can save one HTTPS destination for a Collector or supported OTLP service, an optional Axiom dataset name, and an optional Bearer credential, and separately enable export. We store the organization identifier, destination address, optional dataset name, authentication choice, enabled state, revision, and encrypted optional credential in a private PostgreSQL schema hosted by Supabase. For direct Axiom export, the application sends the saved dataset name in the x-axiom-dataset routing header. The application uses the credential to authenticate delivery; the dataset routing header and credential are not fields of the audit event payload. Authorized Admins can read the saved destination and optional dataset name and whether a credential is present, but the portal does not display the saved credential.

When export is enabled, supported tool events can include the validated fetch URL and reason or search query and reason, together with the final public result or error text returned to the MCP client. They also include trusted organization and actor identifiers, operation identifier, tool, outcome, duration, and time. A captured fetch URL can include noncredential query parameters and fragments. Invitation send, resend, and revoke events include the actor, organization, target email address or invitation identifier, role where applicable, action, outcome, and time. Audit destination Save and Test events include action and outcome metadata; those event payloads exclude the saved endpoint, dataset name, and credential. These exports are separate from internal operator logs.

Before export, Thermus replaces recognized credential fields and selected credential-bearing URL parameters. This redaction uses patterns; it does not remove every secret, personal detail, or confidential value. Sign-in form fields, session cookies, request Authorization headers, and the saved destination credential are not collected as audit event fields. Information repeated in tool inputs or returned text can still be captured. The existing restrictions on submitting secrets, confidential information, sensitive personal information, and regulated data still apply.

Exported result text is limited to 65,536 bytes; the serialized captured event is limited to 131,072 bytes. A truncated exported result copy includes a [TRUNCATED] marker and original and captured byte counts. These capture limits do not shorten the result returned to your MCP client. Unsupported or invalid captures can be omitted.

The optional Test action attempts to send one synthetic event for the saved destination revision, including organization and actor identifiers, time, and the revision. Test can run while export is disabled. It does not save edits or enable export, and it proves neither future delivery nor durable receipt or storage. Pending export events remain only in bounded process memory. Delivery is best effort: overload, expiry, disable, changed settings, outages, or shutdown can drop events; retries can produce duplicates. Thermus provides no audit event history or replay. Your organization controls the destination and its retention, access, and onward sharing.

## 3. How we use information

- **Early access:** maintain the waitlist and contact you about early access, as requested when you sign up.
- **Website operation:** deliver pages and guides, troubleshoot failures, maintain security, and prevent abuse or spam.
- **Understanding interest:** measure website performance and which guide topics are requested so we can improve the site and documentation.
- **Responding to you:** answer questions, handle privacy requests, and meet applicable legal obligations.
- **Hosted access:** sign you in, record agreement, maintain sessions, check access, manage organization membership and invitations, and connect authorized MCP clients.
- **Page fetching:** retrieve a requested page, clean and convert it, and return the result to the requesting client.
- **Web search:** send a submitted query to Brave Search, process its search-results HTML, and return the result to the requesting client.
- **Hosted operation:** record request outcomes and account changes, diagnose failures, handle activation recovery and access removal, and support service security and administration.
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
- **Supabase:** hosts the private PostgreSQL schema for organization audit destination settings, including the optional Axiom dataset name, revisions, enabled state, and encrypted optional credentials. Thermus stores no audit event history in that schema. See [Supabase’s Privacy Policy](https://supabase.com/privacy).
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
| `__Host-thermus-sign-in` | Holds temporary sign-in state, a code verifier, return destination, and expiry time to complete sign-in securely. | Up to 10 minutes. |
| `__Host-thermus-session` | Holds the encrypted WorkOS session described in section 2, including profile data, access and refresh tokens, and security information. | 30 days; this can renew when the session refreshes. WorkOS can end a session earlier. |

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
