export type GuideCategory = 'cli' | 'desktop';

export interface AgentGuide {
  readonly category: GuideCategory;
  readonly id: string;
  readonly name: string;
  readonly add: string;
  readonly code: string;
  readonly codeKind: 'command' | 'config' | 'url';
  readonly authorize: string;
  readonly loginCommand?: string;
  readonly tryIt?: string;
  readonly url: string;
}

export function agentGuides(endpoint: string): readonly AgentGuide[] {
  const shellEndpoint = `'${endpoint.replaceAll("'", "'\\''")}'`;
  return [
    {
      category: 'cli', id: 'claude-code', name: 'Claude Code',
      add: 'Run this in your terminal. User scope makes Thermus available in all projects.',
      codeKind: 'command', code: `claude mcp add --transport http --scope user thermus ${shellEndpoint}`,
      authorize: 'Open Claude Code and run /mcp. Select thermus to start browser sign-in.',
      url: 'https://code.claude.com/docs/en/mcp',
    },
    {
      category: 'cli', id: 'codex', name: 'Codex CLI',
      add: 'Run this in your terminal to add Thermus.',
      codeKind: 'command', code: `codex mcp add thermus --url ${shellEndpoint}`,
      authorize: 'Run this command to start browser sign-in.',
      loginCommand: 'codex mcp login thermus',
      tryIt: 'Start a new Codex session. Run /mcp to check Thermus, then send this prompt.',
      url: 'https://learn.chatgpt.com/docs/extend/mcp?surface=cli',
    },
    {
      category: 'desktop', id: 'claude', name: 'Claude (web / desktop)',
      add: 'Open Customize → Connectors → + Add → Add custom connector. Name it Thermus, paste this URL, and select Continue.',
      codeKind: 'url', code: endpoint,
      authorize: 'Review the detected OAuth settings. Choose Sign in now, complete browser sign-in, and select Add. On Team or Enterprise, an owner must add the connector before members select Connect.',
      tryIt: 'Enable Thermus from the chat + menu → Connectors, then send this prompt.',
      url: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    },
    {
      category: 'desktop', id: 'codex-app', name: 'Codex app',
      add: 'Open Settings → MCP servers → Add server. Name it thermus, choose Streamable HTTP, and paste this URL. Save the server, then select Restart.',
      codeKind: 'url', code: endpoint,
      authorize: 'Select Authenticate beside thermus and complete browser sign-in.',
      tryIt: 'Start a new local chat. Run /mcp to check Thermus, then send this prompt.',
      url: 'https://learn.chatgpt.com/docs/extend/mcp?surface=app',
    },
    {
      category: 'desktop', id: 'chatgpt', name: 'ChatGPT (web setup)',
      add: 'Use ChatGPT on the web. Open Plugins → + → Add custom MCP server. Name it Thermus, paste this URL, and select OAuth. Your account or workspace must allow custom MCP servers.',
      codeKind: 'url', code: endpoint,
      authorize: 'Complete sign-in, review the warning, choose Create as a plugin, then install it from your personal plugins.',
      tryIt: 'Start a Work chat on the web. Type @ and select Thermus, then send this prompt.',
      url: 'https://developers.openai.com/api/docs/guides/custom-mcp-server',
    },
    {
      category: 'desktop', id: 'cursor', name: 'Cursor',
      add: 'Merge this entry into ~/.cursor/mcp.json for all projects. Keep your existing server entries.',
      codeKind: 'config', code: JSON.stringify({ mcpServers: { thermus: { url: endpoint } } }, null, 2),
      authorize: 'Open Cursor’s MCP settings. Enable thermus and connect to start browser sign-in.',
      url: 'https://cursor.com/docs/mcp',
    },
    {
      category: 'desktop', id: 'vscode', name: 'VS Code',
      add: 'Open the Command Palette and run MCP: Add Server. Choose HTTP (HTTP or Server-Sent Events), paste this URL, and name the server thermus. Choose where to save it.',
      codeKind: 'url', code: endpoint,
      authorize: 'Review the trust prompt and complete browser sign-in when VS Code requests it.',
      tryIt: 'Open an agent chat, enable the Thermus tools if needed, then send this prompt.',
      url: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers',
    },
    {
      category: 'desktop', id: 'other', name: 'Other MCP client',
      add: 'Add Thermus as a remote HTTP server with Streamable HTTP and OAuth, using this URL.',
      codeKind: 'url', code: endpoint,
      authorize: 'Use your client’s connect or authenticate action to start browser sign-in.',
      url: 'https://modelcontextprotocol.io/docs/learn/client-concepts',
    },
  ];
}
