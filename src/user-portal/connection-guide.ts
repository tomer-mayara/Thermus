import { agentGuides, type AgentGuide } from './agent-guides.ts';
import { renderGuideSelector } from './guide-selector.ts';

const testPrompt = 'Use Thermus to fetch https://example.com and summarize the page.';

type CopyKind = 'command' | 'config' | 'url' | 'prompt' | 'endpoint';
const copyNames: Record<CopyKind, string> = { command: 'command', config: 'config', url: 'URL', prompt: 'prompt', endpoint: 'endpoint' };

function guideElement<T extends Element = HTMLElement>(parent: Element, selector: string): T {
  const element = parent.querySelector<T>(selector);
  if (!element) throw new Error(`Missing connection guide element: ${selector}`);
  return element;
}

export function renderConnectionGuide(document: Document, endpoint: string): HTMLElement {
  return new ConnectionGuide(document, endpoint).element;
}

class ConnectionGuide {
  readonly element: HTMLElement;
  private readonly guide: HTMLElement;
  private readonly status: HTMLElement;
  private copyRevision = 0;
  private readonly document: Document;

  constructor(document: Document, endpoint: string) {
    this.document = document;
    this.element = document.createElement('div');
    this.element.className = 'connection-widget';
    this.element.innerHTML = `
      <div id="agent-instructions" class="connection-guide"></div>
      <div class="endpoint-row"><p></p></div>
      <p class="guide-status" role="status" aria-live="polite" aria-atomic="true"></p>
    `;
    this.guide = guideElement(this.element, '.connection-guide');
    this.status = guideElement(this.element, '[role="status"]');
    const guides = agentGuides(endpoint);
    this.element.prepend(renderGuideSelector(document, guides, (agent) => {
      this.showGuide(agent);
      this.status.textContent = `${agent.name} guide selected.`;
    }));
    const firstGuide = guides[0];
    if (firstGuide) this.showGuide(firstGuide);
    const endpointRow = guideElement(this.element, '.endpoint-row');
    guideElement(endpointRow, 'p').textContent = `MCP endpoint: ${endpoint}`;
    endpointRow.append(this.copyButton(endpoint, 'endpoint'));
  }

  private copyButton(text: string, kind: CopyKind): HTMLButtonElement {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = `guide-copy copy-${kind}`;
    button.textContent = `Copy ${copyNames[kind]}`;
    button.addEventListener('click', () => { void this.copy(text, kind, button); });
    return button;
  }

  private async copy(text: string, kind: CopyKind, button: HTMLButtonElement): Promise<void> {
    const revision = ++this.copyRevision;
    this.status.textContent = '';
    button.textContent = `Copy ${copyNames[kind]}`;
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard) throw new Error('Clipboard is unavailable');
      await clipboard.writeText(text);
      const name = copyNames[kind];
      if (revision === this.copyRevision) {
        this.status.textContent = `${name[0]?.toUpperCase()}${name.slice(1)} copied.`;
        button.textContent = 'Copied';
      }
    } catch {
      if (revision === this.copyRevision) {
        this.status.textContent = 'Could not copy. Select the text and copy it manually.';
        button.textContent = 'Copy failed';
      }
    }
  }

  private codeBlock(text: string, kind: CopyKind): HTMLElement {
    const block = this.document.createElement('div');
    block.className = 'guide-code';
    const pre = this.document.createElement('pre');
    const code = this.document.createElement('code');
    code.textContent = text;
    if (kind === 'prompt') code.className = 'test-prompt';
    pre.append(code);
    block.append(pre, this.copyButton(text, kind));
    return block;
  }

  private showGuide(agent: AgentGuide): void {
    ++this.copyRevision;
    this.guide.innerHTML = `
      <div class="guide-bar"><span>QUICK GUIDE</span><span class="guide-agent"></span></div>
      <ol class="guide-steps">
        <li><h3>Add Thermus</h3><div class="add-content"><p></p></div></li>
        <li><h3>Authorize access</h3><div class="authorize-content"><p></p></div></li>
        <li><h3>Try it</h3><p class="try-instruction"></p><div class="prompt-content"></div></li>
      </ol>
      <a class="client-guide">Official client guide ↗</a>
    `;
    guideElement(this.guide, '.guide-agent').textContent = agent.name;
    const add = guideElement(this.guide, '.add-content');
    guideElement(add, 'p').textContent = agent.add;
    add.append(this.codeBlock(agent.code, agent.codeKind));
    const authorize = guideElement(this.guide, '.authorize-content');
    guideElement(authorize, 'p').textContent = agent.authorize;
    if (agent.loginCommand) authorize.append(this.codeBlock(agent.loginCommand, 'command'));
    const consent = this.document.createElement('p');
    consent.textContent = 'Sign in to Thermus in your browser. Choose the intended workspace. Approve the connection.';
    authorize.append(consent);
    guideElement(this.guide, '.try-instruction').textContent = agent.tryIt ?? 'Send this prompt in your agent.';
    guideElement(this.guide, '.prompt-content').append(this.codeBlock(testPrompt, 'prompt'));
    guideElement<HTMLAnchorElement>(this.guide, 'a').href = agent.url;
  }
}
