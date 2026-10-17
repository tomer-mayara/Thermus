export interface AgentGuide {
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
      id: 'claude-code', name: 'Claude Code',
      add: 'Run this in your terminal. User scope makes Thermus available in all projects.',
      codeKind: 'command', code: `claude mcp add --transport http --scope user thermus ${shellEndpoint}`,
      authorize: 'Open Claude Code and run /mcp. Select thermus to start browser sign-in.',
      url: 'https://code.claude.com/docs/en/mcp',
    },
    {
      id: 'codex', name: 'Codex CLI',
      add: 'Run this in your terminal to add Thermus.',
      codeKind: 'command', code: `codex mcp add thermus --url ${shellEndpoint}`,
      authorize: 'Run this command to start browser sign-in.',
      loginCommand: 'codex mcp login thermus',
      tryIt: 'Start a new Codex session. Run /mcp to check Thermus, then send this prompt.',
      url: 'https://learn.chatgpt.com/docs/extend/mcp?surface=cli',
    },
    {
      id: 'cursor', name: 'Cursor',
      add: 'Merge this entry into ~/.cursor/mcp.json for all projects. Keep your existing server entries.',
      codeKind: 'config', code: JSON.stringify({ mcpServers: { thermus: { url: endpoint } } }, null, 2),
      authorize: 'Open Cursor’s MCP settings. Enable thermus and connect to start browser sign-in.',
      url: 'https://cursor.com/docs/mcp',
    },
    {
      id: 'vscode', name: 'VS Code',
      add: 'Merge this entry into .vscode/mcp.json in your workspace. Keep your existing server entries.',
      codeKind: 'config', code: JSON.stringify({ servers: { thermus: { type: 'http', url: endpoint } } }, null, 2),
      authorize: 'Run MCP: List Servers from the Command Palette. Select thermus, then start it and authenticate.',
      url: 'https://code.visualstudio.com/docs/agent-customization/mcp-servers',
    },
    {
      id: 'claude', name: 'Claude (web / desktop)',
      add: 'Open Customize → Connectors → + Add → Add custom connector. Name it Thermus and enter this URL.',
      codeKind: 'url', code: endpoint,
      authorize: 'Review the OAuth setup and choose Sign in now. Your account or workspace must allow custom connectors.',
      tryIt: 'Enable Thermus from the chat + menu → Connectors, then send this prompt.',
      url: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    },
    {
      id: 'chatgpt', name: 'ChatGPT',
      add: 'Open Plugins → + → Add custom MCP server. Name it Thermus, enter this URL, and select OAuth. Your account or workspace must allow custom MCP servers.',
      codeKind: 'url', code: endpoint,
      authorize: 'Complete sign-in, review and create the plugin, then install it.',
      tryIt: 'Use @Thermus in a Work chat, then send this prompt.',
      url: 'https://developers.openai.com/api/docs/guides/custom-mcp-server',
    },
    {
      id: 'other', name: 'Other MCP client',
      add: 'Add Thermus as a remote HTTP server with Streamable HTTP and OAuth, using this URL.',
      codeKind: 'url', code: endpoint,
      authorize: 'Use your client’s connect or authenticate action to start browser sign-in.',
      url: 'https://modelcontextprotocol.io/docs/learn/client-concepts',
    },
  ];
}
