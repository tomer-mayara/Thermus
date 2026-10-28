# Admin Quick start

Status: approved for implementation by the owner on 28 October 2026.
Implementation and current-candidate review are in progress. This approval
sets the product scope; it is not approval of the final implementation candidate.
Provider links reviewed: 28 October 2026.

## Purpose

Help the first Admin set up an organization after creation. Show three tasks:

1. Restrict direct Internet access in the organization's agents and connect Thermus.
2. Send Thermus audit logs to an OpenTelemetry destination.
3. Invite users. Keep identity-provider enrollment visible as a planned second path.

The page guides an Admin through settings owned by Thermus and other vendors.
It does not enforce agent network restrictions or prove that setup is complete.

## Scope and entry

- Add a `quick-start` route relative to the configured portal base URL.
- Show the page only to an Admin with current access to the selected organization.
- Check access on the server. A hidden navigation item is not an access check.
- Resolve the organization from the current authorized session, not a query value.
- Display the selected organization name above the guide.
- After successful organization creation and selection, open Quick start.
- Keep the normal destination for later sign-ins and existing organization access.
- Do not send every Admin login to Quick start.
- Keep Quick start available after the first visit.
- Use this navigation order for Admins: Quick start / Connect / Switch Workspace / Members / Audit Log.
- Quick start is the first menu item for Admins. Non-admins retain their current navigation.
- Return an access notice when the selected organization has no current Admin access.

Before this implementation, successful activation opens the portal root and
shows Connect. The approved change opens Quick start after the new organization
is selected.
See [signup redirect](../../../src/interfaces/web/auth/workos/workos-signup-routes.ts)
and [portal navigation](../../../src/interfaces/user-portal/portal.ts).
The [administration layout](../../../src/interfaces/web/account/members-page-layout.ts)
shares the Admin navigation.

## Page layout

Use the existing workspace header and visual style. The page has:

- Heading: **Quick start**.
- Introduction: “Set up your organization.” The header shows its name.
- Action: **Copy guide as Markdown**.
- Three numbered sections with visible summaries and instructions.
- An expandable provider-controls table in step 1.
- One clear primary action in each section.

Keep step summaries, instructions, and primary links visible. Only the provider
table needs a disclosure; do not add a hidden expansion to each step card.
Use numbered steps, not checkboxes, progress bars, completion badges, or a setup score.
Thermus cannot observe whether external controls are correct or logs arrived.
Use keyboard-operable disclosures and visible focus styles.
On narrow screens, stack actions and provider rows without horizontal page scrolling.

Approved visual references:
[desktop mockup](mockup-desktop.png), [mobile mockup](mockup-mobile.png), and
[expanded provider details](mockup-provider-details.png).
These images illustrate this specification; they are not working product pages.
All mockup data are examples. The fictional workspace is Acme Engineering.
The prototype copy uses that name and retains the portal and MCP URL placeholders.

## Step 1 — Restrict direct Internet access and connect Thermus

Summary: “Use your agents' organization controls to restrict direct web access.
Then connect Thermus for approved search and page retrieval.”

Primary action: **Open Connect**, linked to the selected organization's portal root.
The detail includes the provider table below and the guide's verification steps.
Do not add an Internet-access switch to Thermus.

“Direct Internet access” has several paths. A browser or web-search control does
not also establish shell network restrictions, cloud-agent egress restrictions,
or controls for other connectors. State that distinction beside the provider links.
The available policies and scope depend on the vendor, product edition, and deployment.
Do not claim that one switch covers every agent or every Internet path.

| Agent | Organization controls or official guidance | Scope note |
| --- | --- | --- |
| Claude web / desktop | [Organization capabilities](https://claude.ai/admin-settings/capabilities); [web search guidance](https://support.claude.com/en/articles/10684626-enable-and-use-web-search) | Review web capabilities. Do not treat this as a shell or cloud egress policy. |
| Claude Code | [Claude Code administration](https://claude.ai/admin-settings/claude-code); [server-managed settings](https://code.claude.com/docs/en/server-managed-settings) | Review managed tool and network policies for Claude Code. |
| Cursor | [Team extension security](https://cursor.com/dashboard/team-settings?view=extension-security); [agent run modes](https://cursor.com/docs/agent/security/run-modes) | Review the available team controls and each run mode. |
| ChatGPT / Codex | [Enterprise agent security](https://learn.chatgpt.com/docs/enterprise/agent-security) | Official guidance fallback; no stable organization control URL was verified. Review web, local shell, and cloud settings separately. |
| VS Code / GitHub Copilot | [Enterprise AI settings](https://code.visualstudio.com/docs/enterprise/manage-ai-settings) | Official guidance fallback; review managed policies and applicable agent environments. |

The table is a starting set, not a claim that all clients expose equivalent controls.
Recheck links and wording before implementation or publication.
Label documentation fallbacks as guidance; do not label them “Open controls.”

Connect already has guides for Claude Code, Codex CLI, Claude web / desktop,
Codex app, ChatGPT web, Cursor, VS Code, and Other MCP client.
Reuse those guides rather than duplicate their connection commands here.
See [agent guides](../../../src/interfaces/user-portal/agent-guides.ts).

Ask the Admin to check both outcomes in a representative agent: the direct path
is blocked by the intended organization policy, and an authorized Thermus search
or page retrieval works. A prompt instruction alone is not network enforcement.

## Step 2 — Configure audit logs

Summary: “Send Thermus audit logs to your OpenTelemetry destination.”
Primary action: **Open Audit Log**, linked to `logging` under the portal base URL.

Use the current labels: Destination, Axiom, Custom, OTLP logs endpoint,
Axiom dataset, Bearer token, Enable export, Save, and Test.
Explain that Thermus accepts one HTTPS OTLP/HTTP JSON logs destination per organization.
Both Axiom and Custom require a Bearer token. Axiom also requires a dataset.

Recommend this sequence:

1. Enter the destination, endpoint, token, and Axiom dataset when applicable.
2. Keep Enable export off for the initial check, then select Test.
3. Check the destination for the synthetic test event.
4. Turn Enable export on and select Save to enable ongoing export.

State beside the sequence: **Test saves all submitted settings, including the
Enable export switch, before sending a synthetic event.** Test can run with export
off. Save or Test can enable or disable export. Check the switch before either action.
Test is not a required gate for enabling export.

If Save fails or is unconfirmed, no Test is sent. Read saved settings before
another change; a pending Save can finish later. A failed or unconfirmed Test
does not undo settings already saved, and the event might have arrived.
Test does not prove continued delivery or durable storage.

Keep the existing audit help authoritative. Explain briefly that export can
include tool inputs, results or errors, and supported administration metadata.
Delivery is best effort, can lose or duplicate events, and has no history or replay.
Pattern-based redaction cannot remove every secret from free text.
Do not include a token or real log content in the copied guide.
See [audit help](../../../src/interfaces/web/account/administration-help-documents.ts)
and [logging form](../../../src/interfaces/web/account/logging-page.ts).

## Step 3 — Add users

Summary: “Invite users now. Organization identity-provider enrollment is planned.”
Primary action: **Open Members**, linked to `members` under the portal base URL.

The available path is Members → Invite member → Email address → Role →
Send invitation. Recommend User for product and MCP access. Explain that Admin
also manages members and organization settings. The recipient must accept the
invitation and sign in. Pending invitations reserve a seat on a limited plan.
Do not copy the member list or invitation links into the guide.
See [Members form](../../../src/interfaces/web/account/administration-pages.ts).

Show the second desired path as **Identity-provider enrollment — Planned**.
It has explanatory text and no clickable configuration action in v1.
State: “This setup path is not available in Thermus yet. Use invitations now.”
Do not suggest that enabling SSO alone creates memberships or auto-enrollment.

Future enrollment needs its own approved product scope: identity-provider setup,
admission and domain rules, provisioning or just-in-time enrollment, initial roles,
seat checks, removal behavior, and audit evidence. It must preserve the desired
choice between manual invitations and managed enrollment.
The current [onboarding invariant](../../implementation/self-onboarding-plan.md)
uses invitations as the member admission path; SSO and Directory Sync are not this
page's implementation scope. The optional application-level Google onboarding
adapter is not a customer identity-provider configuration feature.

## Markdown copy contract

[guide.md](guide.md) is the approved exact copy template. The page and copy action
must use the same canonical content so collapsed details are never omitted.
The UI may present the canonical text as summaries, tables, and disclosures.
Do not maintain a separate shorter guide for clipboard output.

Replace `{{organization_name}}`, `{{portal_base_url}}`, and `{{mcp_url}}` at runtime.
Use real absolute HTTPS URLs from trusted portal configuration and current
organization context. Normalize the portal base URL with a trailing slash.
Keep placeholders in this design sample. Preserve Markdown when substituting a name.
Include the full guide even when every detail is collapsed.
Copy no credentials, session values, member lists, invitation links, or log records.
Begin the guide with the brief request for LLM assistance in the template.

Announce “Copied” through a status region only after clipboard write succeeds.
On failure, show a selectable Markdown fallback with a clear manual-copy action.
Do not claim success for a denied or unavailable clipboard operation.

## Manual acceptance scenarios

- Given a new organization is active, when its first Admin is selected after creation,
  then Quick start opens with that organization's name and scoped links.
- Given an existing Admin signs in later, when the normal sign-in flow completes,
  then Quick start remains available without replacing the normal destination.
- Given a User or an Admin who lost access, when Quick start is requested directly,
  then the server refuses access to the selected organization's Admin guide.
- Given an Admin switches workspaces, when Quick start opens again, then its name,
  links, and copied guide use the newly authorized workspace context.
- Given all details are collapsed, when Copy guide as Markdown succeeds, then the
  clipboard contains the full guide and an accessible Copied status is announced.
- Given clipboard access fails, when copy is requested, then selectable Markdown
  appears and no success status is announced.
- Given the audit instructions are read, when the Admin follows Test, then the
  instructions make its save side effect and destination receipt check clear.
- Given step 3 is read, when the Admin sees identity-provider enrollment, then it
  is marked Planned and has no working or misleading configuration link.
- Given a narrow screen or keyboard-only navigation, when the guide is used,
  then all steps, disclosures, links, and copy fallback remain usable.

## Delivery boundary

The approved implementation adds the protected Quick start page, its full
Markdown copy action, the Admin navigation item, and the new-organization
landing destination. It includes acceptance-first BDD, focused TDD, browser
checks, and the checks selected from the complete implementation candidate.

The work does not change provider settings, deploy the application, enforce
external network policy, or add identity-provider enrollment. Legal documents
and the existing audit help keep their approved content. Final review and any
required independent human approval must cover the completed candidate.

## Design review

The manager checked the dark desktop at 1024 pixels, mobile at 390 pixels,
small mobile at 320 pixels, and light desktop at 1024 pixels. Closed and expanded
views had no horizontal overflow. Buttons and disclosures were at least 48 pixels
high. The browser reported no JavaScript errors. Copy output matched `guide.md`
with the sample organization name substituted. Browser stubs verified clipboard
success and denial; native host clipboard permission was not established.
No production test suite applies to these documents and mockups. Habit-hooks was
explicitly invoked for this specification and the guide; both were outside its
configured file scope, so it scanned no files. This review covers the design.
The owner's later implementation approval does not make these prototype checks
evidence for the product implementation.
