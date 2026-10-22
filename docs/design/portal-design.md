# Portal design

The owner approved this design for implementation on 16 October 2026.
It covers the public portal, signup, and hosted AuthKit sign-in.

## Visual system

Use the existing Thermus logo and IBM Plex fonts from the marketing design kit.
Use Ink `#17181D`, Card `#212228`, Cream `#F3F2EE`, Gray `#B4BAC0`,
Orange `#E8552A`, and control borders `#7B7E88`. Use dark text on orange
buttons, visible keyboard focus, and at least 48px action heights.

The desktop portal has a brand panel and a welcome card. Signup has a short
step list and a document card. On mobile, stack the content and omit the
diagram. The hosted sign-in form keeps its existing authentication methods.

## Approved copy

- MCP GATEWAY FOR AGENT WEB ACCESS
- Protect against prompt injection and data leaks from AI agents
- Security for organizations that are deploying organization-wide AI tools
  that give employees the ability to create agents.

Keep the functional actions: Sign in, Start free access, and Activate free
access. Free access requires no card and creates no automatic charge.

## Simple flow diagram

Show three nodes: Your agents, Thermus, and The web. Only Thermus has an
orange border. Show these four labelled arrows:

- Your agents to Thermus: white, Request + reason.
- Thermus to The web: white, Approved.
- The web to Thermus: dashed red, Raw pages.
- Thermus to Your agents: green, Clean.

Do not add internal boxes, a legend, Markdown labels, or a path around Thermus.
Give the diagram a text equivalent for assistive technology.

## Behavior

The portal must read the session before it selects a view. Keep the existing
product access, MCP connection, and sign-out behavior.
Use the current login and signup routes.

For signed-in users with product access, put the organization ID, roles, and
browser-versus-MCP workspace explanation in a native Details disclosure below
the MCP setup steps. Start it closed. Use small gray text and wrap long IDs on
narrow screens. Keep the profile, Sign Out, endpoint, and setup steps visible.
Remove the organization page link from both access states. Keep the no-access
message and Start free access recovery action visible.

Signup creates a named organization after identity sign-in. Show an editable
organization name and one unchecked organization/authority agreement. Trim the
name and accept 1 to 100 UTF-16 units of well-formed text without controls.
Do not add account or payment fields. Keep all approved document text, versions,
hashes, and the exact agreement. The approved personal-User bundle cannot
authorize organization creation. The marked test bundle is not legal approval. Keep the existing origin, CSRF, eligibility,
email verification, and activation checks.

Render the full legal documents as readable text. On desktop, readers must
support keyboard scrolling. On mobile, use disclosures with the original
opening text and the full document available in normal page flow. Do not
require reading or scrolling before activation. Keep the agreement outside
the disclosures. Give closed and failure states usable recovery actions.

After confirmed creation, select the new organization through a current
membership check and open its MCP guide. Display its persisted name. The
selected browser organization and guide organization must match. The portal
reads the name from the current active membership; an absent or blank name
shows unavailable access rather than a guessed workspace name. A failed
switch offers safe recovery and must not repeat the first-Admin grant.

## Organization selection

After signup, the organization selector uses the Thermus logo, local IBM Plex
fonts, and the same Ink, Card, Cream, Gray, and Orange colors as the portal.
Show the available workspaces in a clear card with controls at least 48px high.
Keep long names readable, mark the selected workspace, and show keyboard focus.
The page must fit narrow screens without horizontal scrolling.

Keep organization selection as an HTML form that works without JavaScript.
Preserve the existing POST route, CSRF protection, return destination, access
checks, escaped organization names, and non-cacheable responses.

The implemented [desktop](portal-screenshots/organizations-desktop.png) and
[mobile](portal-screenshots/organizations-mobile.png) previews use the built
portal assets and a sample personal workspace.

## AI agent quick guide

For a user with product access, show a native radio group labelled Connect
with above the client selector. Offer CLI and Desktop and Web Apps. Start with CLI
and Claude Code. CLI also offers Codex CLI. Label its selector Your AI agent.
Desktop and Web Apps starts with Claude (web / desktop). It also offers Codex app,
ChatGPT (web setup), Cursor, VS Code, and Other MCP client. Label its selector
Your desktop app. Keep the last selection for each method while the page is
open. Native radio controls support keyboard navigation and show focus.
Keep the heading Connect your MCP client and the free-access sentence.

Show a compact terminal-style panel with three steps: Add Thermus, Authorize
access, and Try it. Use the existing Ink, Card, Cream, and Orange colors. Use
local IBM Plex Mono for commands, JSON, and step numbers. Keep controls at least
48px high and wrap commands and long URLs on narrow screens. Keep the full MCP
endpoint visible in its own paragraph, with a separate Copy endpoint button.
Keep Details closed as the last item below the guide.

Method and app selection change only the guide. They make no request and
change no access.
Use the MCP endpoint supplied by the server in all client commands, JSON, and
URL fields. Quote shell arguments and encode JSON. Render the endpoint as text.
Copy controls report success only after the clipboard write completes. If the
clipboard is unavailable or refuses the write, show a manual-copy instruction.
The clicked button shows Copied or Copy failed when the operation completes.
Restore its Copy label when a new attempt begins.
A late copy result must not replace the status of a newly selected guide.

The shared consent text tells the user to sign in to Thermus, choose the
intended workspace, and approve the connection. The test prompt is:
`Use Thermus to fetch https://example.com and summarize the page.`
Each selection links to its official client guide. Account and workspace
permissions can limit custom connectors or MCP servers.

The desktop client instructions were checked on 19 October 2026 against
their official sources. The CLI instructions were checked on 17 October 2026 against the
[WorkOS MCP guide](https://workos.com/docs/mcp) and these client sources:

| Client | Setup shown | Official guide |
|---|---|---|
| Claude Code | Add the HTTP server in user scope for all projects; use `/mcp` to sign in. | [Claude Code MCP](https://code.claude.com/docs/en/mcp) |
| Codex CLI | Add the server with `--url`; use `codex mcp login thermus`; start a new session and check `/mcp`. | [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Codex app | Open Settings → MCP servers → Add server; choose Streamable HTTP and paste the URL; save, restart, and authenticate. | [Codex app MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=app) |
| Cursor | Merge the entry into `~/.cursor/mcp.json` for all projects; retain existing entries. | [Cursor MCP](https://cursor.com/docs/mcp) |
| VS Code | Run MCP: Add Server from the Command Palette; choose HTTP, paste the URL, name the server, and choose where to save it; review trust and sign in. | [VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers) |
| Claude (web / desktop) | Add a custom connector through Customize → Connectors; sign in and enable it in the chat. | [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) |
| ChatGPT (web setup) | On the web, add a custom MCP server through Plugins; select OAuth, sign in, create and install it; select Thermus with @ in a Work chat on the web. | [ChatGPT custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server) |
| Other MCP client | Add a remote Streamable HTTP server with OAuth. | [MCP client concepts](https://modelcontextprotocol.io/docs/learn/client-concepts) |

These are client setup instructions. The widget does not install software,
register a server, or show a connected state. Browser sign-in and client consent
continue through the existing server and provider routes.

## Verification

First specify the new visible behavior in failing acceptance tests. Run the
changed tests, the required repository gates, and desktop and mobile browser
checks. Check narrow screens, zoom, keyboard focus, document disclosures,
and the four arrow directions. Record the results in the pull request.

Hosted AuthKit branding is an environment setting. Save the previous branding
before applying a change. Match the production client ID, review the staged
HTML and CSS, and keep authentication methods and redirect settings unchanged.
