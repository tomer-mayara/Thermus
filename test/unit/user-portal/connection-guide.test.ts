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
  const changeMethod = (value: 'cli' | 'desktop') => {
    const radio = element<HTMLInputElement>(section, `input[name="connection-method"][value="${value}"]`);
    radio.checked = true;
    radio.dispatchEvent(new view.Event('change'));
  };
  return { section, changeAgent, changeMethod };
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

test('Given a dynamic endpoint, when CLI, JSON and desktop URL instructions render, then they preserve its value without executing shell or HTML', () => {
  const endpoint = 'https://gateway.example/team/mcp?name=O\'Brien&x=$(false)&tag="<img src=x>"';
  const { section, changeAgent, changeMethod } = guide(undefined, endpoint);
  for (const agent of ['claude-code', 'codex']) {
    changeAgent(agent);
    const command = element(section, '.add-content code').textContent ?? '';
    const shellArguments = execFileSync('/bin/sh', ['-c', command.replace(/^(claude|codex) /, 'printf \'%s\\n\' ')], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(shellArguments.includes(endpoint), `${agent} preserves the endpoint as one argument`);
  }
  changeMethod('desktop');
  changeAgent('cursor');
  const config = JSON.parse(element(section, '.add-content code').textContent ?? '');
  assert.equal(config.mcpServers.thermus.url, endpoint);
  for (const agent of ['claude', 'codex-app', 'chatgpt', 'vscode', 'other']) {
    changeAgent(agent);
    assert.equal(element(section, '.add-content code').textContent, endpoint);
  }
  assert.equal(section.querySelector('img'), null);
});


test('Given selections in both setup methods, when the user switches methods, then each method keeps its selected app', () => {
  const { section, changeAgent, changeMethod } = guide();
  changeAgent('codex');
  changeMethod('desktop');
  assert.equal(element<HTMLSelectElement>(section, 'select').value, 'claude');
  changeAgent('vscode');
  changeMethod('cli');
  assert.equal(element<HTMLSelectElement>(section, 'select').value, 'codex');
  changeMethod('desktop');
  assert.equal(element<HTMLSelectElement>(section, 'select').value, 'vscode');
  assert.equal(element(section, '[role="status"]').textContent, 'VS Code guide selected.');
});

for (const outcome of ['resolve', 'reject'] as const) {
  test(`Given a pending copy that will ${outcome}, when the setup method changes, then old feedback cannot replace the selected app status`, async () => {
    let finish!: () => void;
    const { section, changeMethod } = guide(() => new Promise<void>((resolve, reject) => {
      finish = outcome === 'resolve' ? resolve : () => reject(new Error('Denied'));
    }));
    element<HTMLButtonElement>(section, '.copy-command').click();
    changeMethod('desktop');
    finish();
    await flushCopy();
    assert.equal(element(section, '[role="status"]').textContent, 'Claude (web / desktop) guide selected.');
    assert.equal(element(section, '.copy-url').textContent, 'Copy URL');
  });
}

test('Given desktop app setup, when the URL, endpoint and prompt are copied, then the clipboard receives the displayed values', async () => {
  const writes: string[] = [];
  const { section, changeMethod } = guide(async (text) => { writes.push(text); });
  changeMethod('desktop');
  for (const kind of ['url', 'endpoint', 'prompt']) {
    element<HTMLButtonElement>(section, `.copy-${kind}`).click();
    await flushCopy();
  }
  assert.deepEqual(writes, ['https://gateway.example/team/mcp', 'https://gateway.example/team/mcp', element(section, '.test-prompt').textContent]);
});
