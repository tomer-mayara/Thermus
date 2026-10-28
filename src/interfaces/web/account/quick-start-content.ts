interface GuideContext {
  readonly organizationName: string;
  readonly publicBaseUrl: string;
  readonly mcpResourceUrl: string;
}

export const quickStartProviders = [
  { name: 'Claude web / desktop', links: [
    { label: 'Organization capabilities', url: 'https://claude.ai/admin-settings/capabilities' },
    { label: 'Web search guidance', url: 'https://support.claude.com/en/articles/10684626-enable-and-use-web-search' },
  ] },
  { name: 'Claude Code', links: [
    { label: 'Claude Code administration', url: 'https://claude.ai/admin-settings/claude-code' },
    { label: 'Server-managed settings', url: 'https://code.claude.com/docs/en/server-managed-settings' },
  ] },
  { name: 'Cursor', links: [
    { label: 'Team extension security', url: 'https://cursor.com/dashboard/team-settings?view=extension-security' },
    { label: 'Agent run modes', url: 'https://cursor.com/docs/agent/security/run-modes' },
  ] },
  { name: 'ChatGPT / Codex', links: [
    { label: 'Enterprise agent security guidance', url: 'https://learn.chatgpt.com/docs/enterprise/agent-security' },
  ] },
  { name: 'VS Code / GitHub Copilot', links: [
    { label: 'Enterprise AI settings guidance', url: 'https://code.visualstudio.com/docs/enterprise/manage-ai-settings' },
  ] },
] as const;

export const quickStartInstructions = {
  internet: {
    title: 'Turn off direct internet access',
    lead: 'Select the correct organization in each provider before changing its controls. Turn off direct web access, then connect Thermus for search and page retrieval. Keep Thermus and required agent services allowed. Thermus does not enforce these external network settings.',
    scope: 'Review native web tools, shell commands, cloud agents, and other connectors separately. A web-search switch does not block shell or cloud traffic. Policies vary by edition and deployment. Prompts alone do not enforce network policy.',
    fallback: 'ChatGPT / Codex and VS Code / Copilot have guidance fallbacks; no stable organization control URL was verified. Check each policy\'s scope.',
    connect: 'Follow your client\'s connection and authorization guide.',
    verify: 'Check that the intended policy blocks direct access and an authorized Thermus search or page retrieval works.',
  },
  audit: {
    title: 'Configure audit logs',
    lead: 'Choose Axiom or Custom. Enter an HTTPS OTLP/HTTP JSON logs endpoint and a Bearer token. For Axiom, also enter an Axiom dataset and use a token scoped to it. For Custom, leave the Axiom dataset empty.',
    destination: 'Set one destination for your organization\'s audit logs; system logs stay internal.',
    sequence: ['Keep Enable export off for the initial check, then select Test.', 'Check your destination for the synthetic test event.', 'Turn Enable export on and select Save for ongoing export.'],
    note: 'Test saves settings, including the Enable export switch, before sending.',
    effect: 'Either Save or Test can enable or disable export. Check the switch first. Test is optional and does not prove continued delivery or durable storage.',
    recovery: 'If Save fails or is unconfirmed, no Test is sent; read saved settings before another change. Failed Test does not undo saved settings;',
    help: 'for recovery and token handling.',
    delivery: 'Logs can include tool inputs, results, errors, and administration metadata. Redaction cannot remove every secret from free text. Delivery is best effort: events can be lost or duplicated, with no history or replay. Check destination access and retention.',
  },
  users: {
    title: 'Give your team access',
    invite: 'Select Invite member, enter Email address, choose Role, then select Send invitation. Choose User for product and MCP access. Admin also manages members and organization settings.',
    acceptance: 'Recipients must accept and sign in. Pending invitations reserve seats on a limited plan.',
    plannedTitle: 'Identity-provider enrollment — Planned',
    planned: 'This setup path is not available in Thermus yet. Use invitations now. Enabling SSO alone does not establish automatic enrollment.',
  },
} as const;

export function quickStartContent(context: GuideContext) {
  const base = trustedUrl(context.publicBaseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const navigation = {
    product: base.href,
    quickStart: new URL('quick-start', base).href,
    organizations: new URL('organizations', base).href,
    members: new URL('members', base).href,
    logging: new URL('logging', base).href,
  };
  const endpoint = trustedUrl(context.mcpResourceUrl).href;
  const { internet, audit, users } = quickStartInstructions;
  const providerRows = quickStartProviders.map(provider => `| ${provider.name} | ${provider.links.map(link => markdownLink(link.label, link.url)).join(' · ')} |`);
  const markdown = [
    'Help me complete this Thermus setup. Ask which agents, logging service, and identity provider we use. Check official guidance for our editions. Keep credentials in product forms, outside this chat.',
    `# Thermus Quick start — ${markdownText(context.organizationName)}`,
    `Organization portal: ${navigation.product}\nThermus MCP endpoint: ${endpoint}`,
    `## 1. ${internet.title} and connect Thermus`, internet.lead, internet.scope,
    'Provider links reviewed on 28 October 2026:',
    ['| Agent | Organization controls or official guidance |', '| --- | --- |', ...providerRows].join('\n'),
    internet.fallback,
    `${markdownLink('Open Connect', navigation.product)}. ${internet.connect}`, internet.verify,
    `## 2. ${audit.title}`, `${markdownLink('Open Audit Log', navigation.logging)}. ${audit.destination}`,
    [audit.lead, ...audit.sequence].map((line, index) => `${index + 1}. ${line}`).join('\n'),
    `**${audit.note}** ${audit.effect}`,
    `${audit.recovery} consult ${markdownLink('Audit logs help', navigation.logging)} ${audit.help}`, audit.delivery,
    '## 3. Add users', '### Invite users — available now',
    `${markdownLink('Open Members', navigation.members)}. ${users.invite}`, users.acceptance,
    `### ${users.plannedTitle}`, users.planned,
  ].join('\n\n') + '\n';
  return { navigation, markdown };
}

function trustedUrl(value: string): URL {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Quick start requires a configured HTTP(S) URL without credentials, a query, or a fragment');
  }
  return url;
}

function markdownText(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').replaceAll('&', '&amp;').replace(/[\\`*_{}\[\]()#+\-.!|<>]/g, '\\$&');
}

function markdownLink(label: string, url: string): string {
  return `[${label}](${url.replaceAll('(', '%28').replaceAll(')', '%29')})`;
}
