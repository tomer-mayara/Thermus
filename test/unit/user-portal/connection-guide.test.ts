import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { renderConnectionGuide } from '../../../src/user-portal/connection-guide.ts';

function element<T extends Element = HTMLElement>(parent: Element, selector: string): T {
  const result = parent.querySelector<T>(selector);
  assert.ok(result, `Expected ${selector}`);
  return result;
}

function guide(writeText?: (text: string) => Promise<void>, endpoint = 'https://gateway.example/team/mcp') {
  const { document } = parseHTML('<html><body></body></html>');
  const view = document.defaultView;
  assert.ok(view);
  Object.defineProperty(document, 'defaultView', { value: { Event: view.Event, navigator: { clipboard: writeText ? { writeText } : undefined } } });
  const section = renderConnectionGuide(document, endpoint);
  document.body.append(section);
  const changeAgent = (value: string) => {
    const select = element<HTMLSelectElement>(section, 'select');
    for (const option of select.querySelectorAll('option')) option.removeAttribute('selected');
    element<HTMLOptionElement>(select, `option[value="${value}"]`).selected = true;
    select.dispatchEvent(new view.Event('change'));
  };
  return { section, changeAgent };
}

const flushCopy = async () => { await Promise.resolve(); await Promise.resolve(); };

test('Given clipboard access, when a copy resolves, then the guide announces success and copies the visible text', async () => {
  const writes: string[] = [];
  let finish!: () => void;
  const { section } = guide((text) => { writes.push(text); return new Promise<void>((resolve) => { finish = resolve; }); });
  const button = element<HTMLButtonElement>(section, '.copy-command');
  button.click();
  assert.equal(button.textContent, 'Copy command');
  assert.equal(section.querySelector('[role="status"]')?.textContent, '');
  finish();
  await flushCopy();
  assert.deepEqual(writes, [section.querySelector('.add-content code')?.textContent]);
  assert.equal(section.querySelector('[role="status"]')?.textContent, 'Command copied.');
  assert.equal(button.textContent, 'Copied');
  button.click();
  assert.equal(button.textContent, 'Copy command', 'A new attempt resets feedback while the copy is pending');
  finish();
  await flushCopy();
});

for (const clipboard of ['unavailable', 'rejected'] as const) {
  test(`Given ${clipboard} clipboard access, when the user copies, then the guide gives a manual copy instruction`, async () => {
    const { section } = guide(clipboard === 'rejected' ? async () => { throw new Error('Denied'); } : undefined);
    const button = element<HTMLButtonElement>(section, '.copy-prompt');
    button.click();
    await flushCopy();
    assert.equal(section.querySelector('[role="status"]')?.textContent, 'Could not copy. Select the text and copy it manually.');
    assert.equal(button.textContent, 'Copy failed');
    assert.equal(section.querySelector('.test-prompt')?.textContent, 'Use Thermus to fetch https://example.com and summarize the page.');
  });
}

test('Given a pending copy, when the agent changes before it resolves, then the old success does not replace the new guide status', async () => {
  let finish!: () => void;
  const { section, changeAgent } = guide(() => new Promise<void>((resolve) => { finish = resolve; }));
  element<HTMLButtonElement>(section, '.copy-command').click();
  changeAgent('codex');
  finish();
  await flushCopy();
  assert.equal(section.querySelector('[role="status"]')?.textContent, 'Codex CLI guide selected.');
});

test('Given a dynamic endpoint, when CLI and JSON instructions render, then they preserve its value without executing shell or HTML', () => {
  const endpoint = 'https://gateway.example/team/mcp?name=O\'Brien&x=$(false)&tag="<img src=x>"';
  const { section, changeAgent } = guide(undefined, endpoint);
  for (const agent of ['claude-code', 'codex']) {
    changeAgent(agent);
    const command = element(section, '.add-content code').textContent ?? '';
    const shellArguments = execFileSync('/bin/sh', ['-c', command.replace(/^(claude|codex) /, 'printf \'%s\\n\' ')], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(shellArguments.includes(endpoint), `${agent} preserves the endpoint as one argument`);
  }
  for (const agent of ['cursor', 'vscode']) {
    changeAgent(agent);
    const config = JSON.parse(element(section, '.add-content code').textContent ?? '');
    assert.equal(agent === 'cursor' ? config.mcpServers.thermus.url : config.servers.thermus.url, endpoint);
  }
  assert.equal(section.querySelector('img'), null);
});
