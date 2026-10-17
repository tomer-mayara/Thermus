# Thermus free access: switch, connect, test, and disconnect

Instructions checked on October 16, 2026, with Claude Code 2.1.300.

Thermus is free. There is no payment card, billing, or automatic charge. The subscription switch controls **new-user activation**. Turning it off does not remove access from existing users or their tokens.

## 1. Turn new subscriptions on or off

1. Open the [Thermus service in Render](https://dashboard.render.com/web/srv-db8mnqg473hc739d529g).
2. Select **Environment**, then edit `SELF_SERVE_SIGNUP_ENABLED`.
3. Enter `true` to turn activation on, or `false` to turn it off. Use lower-case text without quote marks.
4. Select **Save and deploy**. This reuses the existing build. **Save, rebuild, and deploy** also works, but a rebuild is unnecessary. **Save only** does not change the running service. See [Render's save options](https://render.com/docs/configure-environment-variables).
5. Wait until the new deployment is **Live**.
6. Open [the signup page](https://app.thermus.ai/signup) in a private browser window. With activation on, the heading is **Start free access**. With activation off, it is **Activation is closed**.

The **Start Subscription** link at [thermus.ai](https://thermus.ai) opens this signup page.

## 2. Test a new subscription

Keep activation on for this test.

1. Use a Google account that has no existing Thermus access.
2. Open [the signup page](https://app.thermus.ai/signup) and sign in with that account.
3. Read the agreement shown on the page. Select its checkbox, then select **Activate free access**.
4. Select the personal workspace if prompted.
5. Confirm that the portal shows product access and **Connect your MCP client**.

An existing user sees **Your access is ready** and **Continue**. That does not test new-user activation. Use another fresh account to repeat the enrollment test.

## 3. Connect Claude Code

Use the Claude Code terminal app. Its own account sign-in is separate from the Thermus connection. Claude Code obtains, stores, and refreshes the Thermus OAuth token; you do not copy a token or API key.

If you used the previous endpoint, follow [Disconnect Claude Code](#5-disconnect-claude-code) to remove the local entry. Then add the new endpoint and sign in again. The old authorization does not apply to the new endpoint.

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

5. In the browser, select the same Google account used for the new subscription. Select its personal workspace and approve the Claude connection.
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

If Claude uses an old Thermus account, repeat the credential-clearing and login steps above, then start a new Claude session.

## 5. Disconnect Claude Code

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
