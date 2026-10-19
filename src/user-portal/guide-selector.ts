import type { AgentGuide, GuideCategory } from './agent-guides.ts';

export function renderGuideSelector(document: Document, guides: readonly AgentGuide[], onSelect: (guide: AgentGuide) => void): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = `
    <fieldset class="guide-method">
      <legend>Connect with</legend>
      <div class="guide-method-options">
        <label><input type="radio" name="connection-method" value="cli" aria-controls="ai-agent agent-instructions" checked><span>CLI</span></label>
        <label><input type="radio" name="connection-method" value="desktop" aria-controls="ai-agent agent-instructions"><span>Desktop Apps</span></label>
      </div>
    </fieldset>
    <label for="ai-agent">Your AI agent</label>
    <select id="ai-agent" aria-controls="agent-instructions"></select>
  `;
  const select = element.querySelector('select')!;
  const label = element.querySelector('label[for="ai-agent"]')!;
  const selections: Record<GuideCategory, string> = { cli: 'claude-code', desktop: 'claude' };
  let category: GuideCategory = 'cli';

  const showOptions = () => {
    select.replaceChildren();
    label.textContent = category === 'cli' ? 'Your AI agent' : 'Your desktop app';
    for (const guide of guides.filter((candidate) => candidate.category === category)) {
      const option = document.createElement('option');
      option.value = guide.id;
      option.textContent = guide.name;
      option.selected = guide.id === selections[category];
      select.append(option);
    }
  };
  const selectGuide = () => {
    const guide = guides.find((candidate) => candidate.id === select.value && candidate.category === category);
    if (!guide) return;
    selections[category] = guide.id;
    onSelect(guide);
  };
  for (const radio of element.querySelectorAll<HTMLInputElement>('input')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      category = radio.value as GuideCategory;
      showOptions();
      selectGuide();
    });
  }
  select.addEventListener('change', selectGuide);
  showOptions();
  return element;
}
