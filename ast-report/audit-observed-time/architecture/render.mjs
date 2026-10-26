import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const version = process.argv[2] ?? 'v1';
const directory = new URL(`./${version}/`, import.meta.url);
const source = await readFile(new URL('comparison.mmd', directory), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:white}#diagram{width:800px}svg{display:block;max-width:800px;height:auto;margin-inline:auto}</style></head><body><div id="diagram"></div></body></html>');
  await page.addScriptTag({ path: '/Users/tomermayara/.npm/_npx/fa58c8ce4c502b5d/node_modules/mermaid/dist/mermaid.min.js' });
  const svg = await page.evaluate(async source => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', flowchart: { htmlLabels: true, curve: 'linear', useMaxWidth: false, wrappingWidth: 280 }, themeVariables: { fontSize: '18px', edgeLabelBackground: '#ffffff', fontFamily: 'Arial, sans-serif' } });
    await mermaid.parse(source);
    const result = await mermaid.render('auditObservedTimestamp', source);
    document.querySelector('#diagram').innerHTML = result.svg;
    return result.svg;
  }, source);
  await writeFile(new URL('comparison.svg', directory), svg);
  await page.locator('#diagram').screenshot({ path: new URL('comparison-800.png', directory).pathname });
  console.log(JSON.stringify({ renderer: 'Mermaid 12.2.0 + Playwright Chromium', width: 800, parsed: true, version }));
} finally { await browser.close(); }
