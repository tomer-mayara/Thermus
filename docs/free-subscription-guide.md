# Thermus free access: switch, sign up, connect, test, and disconnect

The signup and workspace steps were checked against main `fa787be4` on 31 October 2026. The Claude Code steps were checked on October 16, 2026, with Claude Code 2.1.300.

The free tier, Hosted Free, has no payment card, billing, or automatic charge. A free organization has 5 seats, including its creator; a pending invitation holds a seat. With the gateway switch `MCP_TENANTS_ENABLED` on, each organization has its own container, which serves up to 5 tool calls at a time. The control plane pauses the container after 14 days without use ([tier rules](implementation/self-onboarding-plan.md#44-tier-rules)). The subscription switch controls **new organization activation**. Turning it off does not remove access from existing users or their tokens.

## 1. Turn new subscriptions on or off

1. Open the [Thermus service in Render](https://dashboard.render.com/web/srv-db8mnqg473hc739d529g).
2. Select **Environment**, then edit `SELF_SERVE_SIGNUP_ENABLED`.
3. Enter `true` to turn activation on, or `false` to turn it off. Use lower-case text without quote marks.
4. Select **Save and deploy**. **Save only** does not change the running service. See [Render's save options](https://render.com/docs/configure-environment-variables). While the service builds from Git, **Save and deploy** reuses the existing build. From step 5 of the [SO-12 production order](implementation/self-onboarding-s2-release.md#4-production-order), the service runs a prebuilt image, and the deploy starts the image that the service settings name.
5. Wait until the new deployment is **Live**.
6. Open [the signup page](https://app.thermus.ai/signup?tier=free) in a private browser window. With activation on, the heading is **Start free access**. With activation off, it is **Activation is closed**. With `MCP_TENANTS_ENABLED` on, the page is also closed when all free workspaces are in use: the cap `FREE_TENANT_LIMIT` is 25 by default.

The **Start free** link in the pricing section of [thermus.ai](https://thermus.ai/#pricing) opens `https://app.thermus.ai/signup?tier=free`. Only the free tier exists, so the signup page ignores the `tier` value. The [marketing pull request](https://github.com/tomer-mayara/Thermus-Marketing/pull/37) adds the link, and step 9 of the SO-12 production order publishes it. Before that step, the Hosted **Start subscription** button of thermus.ai opens the waitlist, not this signup page.

## 2. Test a new subscription

Keep activation on for this test.

1. Use an email address that has no Thermus access. Hosted sign-in uses email and password through WorkOS, and signup needs a verified email address.
2. Open [the signup page](https://app.thermus.ai/signup?tier=free) and select **Sign in to continue**. Sign in, or create the account and verify its email address. WorkOS sends you back to the signup page.
3. Enter the organization name. Read the Terms of Service and the Privacy Notice on the page. Select the agreement checkbox, then select **Create organization**. You become the first Admin of the organization.
4. **Quick start** opens for the new organization. Select **Connect**.
5. With `MCP_TENANTS_ENABLED` on, Connect first shows "Setting up your workspace. This takes about two minutes." under **Connect your MCP client**. The page reloads every 5 seconds. When the workspace is ready, the connection guide replaces these words. With the switch off, the control plane serves the tools itself, and Connect shows the connection guide at once.

If Connect shows "Workspace setup failed. We have been notified and will fix it.", stop: the operator follows the [failed provision runbook](implementation/tenant-fleet-runbooks.md#1-failed-provision). If it shows "All free workspaces are in use. Try again later.", the free-tenant cap is full; the [workspace setup state](user-portal.md#workspace-setup-state) gives each message.

An existing user sees **Your access is ready** and **Continue**. That does not test new organization activation. Use another fresh account to repeat the test.

## 3. Connect Claude Code

Use the Claude Code terminal app. Its own account sign-in is separate from the Thermus connection. Claude Code obtains, stores, and refreshes the Thermus OAuth token; you do not copy a token or API key.

If you used the previous endpoint, follow [Disconnect Claude Code](#6-disconnect-claude-code) to remove the local entry. Then add the new endpoint and sign in again. The old authorization does not apply to the new endpoint.

1. Open a terminal in your Thermus checkout folder. Replace `/path/to/Thermus` with its actual path:

   ```sh
   cd /path/to/Thermus
   ```

2. Check the existing configuration:

   ```sh
   claude mcp get thermus-production
   ```

   If this server already exists, confirm that its URL is `https://app.thermus.ai/mcp`, then skip the add command. If the URL differs, stop and check the configuration. If the server is absent, run:

   ```sh
   claude mcp add-json --scope local thermus-production '{"type":"http","url":"https://app.thermus.ai/mcp","oauth":{"scopes":"openid profile email offline_access"}}'
   ```

   Run all commands and start Claude from the same folder: [local scope belongs to that project](https://code.claude.com/docs/en/mcp#local-scope). The JSON sets the [OAuth scopes](https://code.claude.com/docs/en/mcp#restrict-oauth-scopes).

3. For a fresh-account test with a different identity, first exit running Claude sessions. Clear the old Thermus credentials:

   ```sh
   claude mcp logout thermus-production
   ```

   Open [the Thermus portal](https://app.thermus.ai/) and select **Sign Out**. Stored credentials can let the login command skip new authorization. Selecting a workspace in the portal does not change an existing MCP token.

4. Start the Thermus login:

   ```sh
   claude mcp login thermus-production
   ```

   If the browser does not open, use `claude mcp login thermus-production --no-browser` and follow the displayed instructions. See [command-line authentication](https://code.claude.com/docs/en/mcp#authenticate-from-the-command-line).

5. In the browser, sign in with the same account that you used for the new subscription. Select the organization that you created, and approve the Claude connection.
6. Check the server, then start a new Claude session:

   ```sh
   claude mcp get thermus-production
   claude
   ```

7. Inside Claude, enter `/mcp` and check the Thermus connection.

## 4. Test a real Thermus call

Send Claude this prompt:

> Use the Thermus getURLAsMarkdown tool exactly once with url https://example.com/ and reason "Free signup test". Do not use another fetch or web tool. Show the returned Markdown.

A successful test shows a **Thermus tool call** and returned Markdown containing **Example Domain**. Connected status or plausible text alone does not prove success.

While the workspace is still being set up, the server answers each MCP call with HTTP `503`, `Retry-After: 15`, and "Your workspace is not ready yet. Try again in 15 seconds." Wait until Connect shows the connection guide, then send the prompt again. If the tool answers "Server restarted. Try again in a minute.", the container of the workspace restarted during the call; send the prompt again after a minute.

If Claude uses an old Thermus account, repeat the credential-clearing and login steps above, then start a new Claude session.

## 5. A paused workspace

With `MCP_TENANTS_ENABLED` on, the control plane pauses a free workspace that had no MCP call for 14 days (`FREE_TENANT_IDLE_DAYS`, 14 by default). A workspace that never served a call counts from its creation. A paused workspace costs nothing.

- Connect shows "Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute." above the connection guide.
- The next MCP call restarts the workspace. Until the restart is complete, for about a minute, each MCP call gets HTTP `503` with `Retry-After: 60` and "Your workspace is restarting after a pause. Try again in a minute." Wait one minute, then send the call again.
- While the workspace restarts, Connect shows "Setting up your workspace. This takes about two minutes."

## 6. Disconnect Claude Code

1. Exit all running Claude sessions that use this server.
2. From the same folder, clear its stored OAuth credentials:

   ```sh
   claude mcp logout thermus-production
   ```

   Stop here if you want to keep the configuration for a later login.

3. For full local removal, run:

   ```sh
   claude mcp remove --scope local thermus-production
   claude mcp list
   ```

4. Confirm that the server is absent. You can also start a new Claude session and check `/mcp`.

Local disconnection does not delete the Thermus account, cancel its access, or prove that remote tokens were revoked.
