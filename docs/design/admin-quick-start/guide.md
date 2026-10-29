Help me complete this Thermus setup. Ask which agents, logging service, and
identity provider we use. Check official guidance for our editions. Keep
credentials in product forms, outside this chat.

# Thermus Quick start — {{organization_name}}

Organization portal: {{portal_base_url}}
Thermus MCP endpoint: {{mcp_url}}

## 1. Turn off direct internet access for AI agents and connect Thermus

Open each AI provider’s admin console, select your organization, and turn off
direct internet access for its agents. Then connect Thermus for search and page retrieval.
Keep Thermus and required agent services allowed. Thermus does not enforce
these external network settings.

Review native web tools, shell commands, cloud agents, and other connectors
separately. A web-search switch does not block shell or cloud traffic. Policies
vary by edition and deployment. Prompts alone do not enforce network policy.

Provider links reviewed on 28 October 2026:

| Agent | Organization controls or official guidance |
| --- | --- |
| Claude web / desktop | [Organization capabilities](https://claude.ai/admin-settings/capabilities) · [Web search guidance](https://support.claude.com/en/articles/10684626-enable-and-use-web-search) |
| Claude Code | [Claude Code administration](https://claude.ai/admin-settings/claude-code) · [Server-managed settings](https://code.claude.com/docs/en/server-managed-settings) |
| Cursor | [Team extension security](https://cursor.com/dashboard/team-settings?view=extension-security) · [Agent run modes](https://cursor.com/docs/agent/security/run-modes) |
| ChatGPT / Codex | [Enterprise agent security guidance](https://learn.chatgpt.com/docs/enterprise/agent-security) |
| VS Code / GitHub Copilot | [Enterprise AI settings guidance](https://code.visualstudio.com/docs/enterprise/manage-ai-settings) |

ChatGPT / Codex and VS Code / Copilot have guidance fallbacks; no stable
organization control URL was verified. Check each policy's scope.

[Open Connect]({{portal_base_url}}). Follow your client's connection and
authorization guide.

Check that the intended policy blocks direct access and an authorized Thermus
search or page retrieval works.

## 2. Configure audit logs

[Open Audit Log]({{portal_base_url}}logging). Set one destination for your
organization's audit logs; system logs stay internal.

1. Choose Axiom or Custom. Enter an HTTPS OTLP/HTTP JSON logs endpoint and
   a Bearer token. For Axiom, also enter an Axiom dataset and use a token scoped
   to it. For Custom, leave the Axiom dataset empty.
2. Keep Enable export off for the initial check, then select Test.
3. Check your destination for the synthetic test event.
4. Turn Enable export on and select Save for ongoing export.

**Test saves settings, including the Enable export switch, before sending.**
Either Save or Test can enable or disable export. Check the switch first.
Test is optional and does not prove continued delivery or durable storage.

If Save fails or is unconfirmed, no Test is sent; read saved settings before
another change. Failed Test does not undo saved settings; consult
[Audit logs help]({{portal_base_url}}logging) for recovery and token handling.

Logs can include tool inputs, results, errors, and administration metadata.
Redaction cannot remove every secret from free text. Delivery is best effort:
events can be lost or duplicated, with no history or replay. Check destination
access and retention.

## 3. Add users

### Invite users — available now

[Open Members]({{portal_base_url}}members). Select Invite member, enter Email
address, choose Role, then select Send invitation. Choose User for product and
MCP access. Admin also manages members and organization settings.

Recipients must accept and sign in. Pending invitations reserve seats on a
limited plan.

### Identity-provider enrollment — Planned

This setup path is not available in Thermus yet. Use invitations now.
Enabling SSO alone does not establish automatic enrollment.
