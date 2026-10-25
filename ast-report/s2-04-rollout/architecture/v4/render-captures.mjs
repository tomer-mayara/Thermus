import puppeteer from '/Users/tomermayara/.npm/_npx/fa58c8ce4c502b5d/node_modules/puppeteer/lib/puppeteer/puppeteer.js';
import fs from 'node:fs/promises';
const dir = new URL('.', import.meta.url);
const browser = await puppeteer.launch(JSON.parse(await fs.readFile(new URL('puppeteer-config.json', dir), 'utf8')));
const renders = [];
try {
  const page = await browser.newPage();
  for (const name of ['l3', ...[1, 2, 6, 7, 13].map(n => `registry-${n}-after`)]) {
    await page.setViewport({ width: 800, height: 1, deviceScaleFactor: 1 });
    const svg = await fs.readFile(new URL(`${name}.svg`, dir), 'utf8');
    await page.setContent(`<html><head><style>body{margin:0;background:white}</style></head><body>${svg}</body></html>`);
    const measure = await page.$eval('svg', e => {
      const box = e.viewBox.baseVal;
      const height = 800 * box.height / box.width;
      Object.assign(e.style, { width: '800px', maxWidth: 'none', maxHeight: 'none', height: `${height}px`, display: 'block' });
      return { width: 800, height, viewBox: e.getAttribute('viewBox') };
    });
    await page.setViewport({ width: 800, height: Math.ceil(measure.height), deviceScaleFactor: 1 });
    await page.screenshot({ path: new URL(`${name}-800.png`, dir).pathname, clip: { x: 0, y: 0, width: 800, height: Math.ceil(measure.height) }, captureBeyondViewport: true });
    renders.push({ name, ...measure });
  }
  await fs.writeFile(new URL('render-validation.json', dir), JSON.stringify({ cliVersion: '12.0.0', browser: 'existing Chrome headless 136', configuration: ['Mermaid source inline configuration', 'puppeteer-config.json'], renders }, null, 2) + '\n');
  console.log(renders);
} finally { await browser.close(); }
