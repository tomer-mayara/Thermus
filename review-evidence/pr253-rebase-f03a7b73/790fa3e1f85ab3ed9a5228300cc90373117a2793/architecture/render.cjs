const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const toolRoot = '/tmp/advanced-mermaid-pr221.X3GtVH/tool/node_modules';
const { chromium } = require(path.join(toolRoot, 'playwright'));
const sources = __dirname;
const output = process.argv[3] ? path.join(__dirname, process.argv[3]) : __dirname;
fs.mkdirSync(output, { recursive: true });
const executablePath = '/Users/tomermayara/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const mermaidPath = path.join(toolRoot, 'mermaid/dist/mermaid.min.js');
const inputs = JSON.parse(fs.readFileSync(path.join(sources, process.argv[2] ?? 'render-inputs.json'), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
  const blockedRequests = [];
  await page.route('**/*', route => { blockedRequests.push(route.request().url()); return route.abort(); });
  const report = {
    parent: 'f03a7b73b2c27dc26477d5378a3356f28744a367',
    head: 'working draft; final SHA refresh required',
    viewport: { width: 800, height: 1000 },
    deviceScaleFactor: 1,
    mermaid: require(path.join(toolRoot, 'mermaid/package.json')).version,
    playwright: require(path.join(toolRoot, 'playwright/package.json')).version,
    browser: browser.version(), executablePath,
    mermaidAsset: mermaidPath,
    mermaidAssetSha256: sha256(fs.readFileSync(mermaidPath)),
    registrySha256: sha256(fs.readFileSync(path.resolve(sources, '../../../architecture/components.md'))),
    diagrams: [], blockedRequests,
  };
  try {
    for (const input of inputs) {
      const source = fs.readFileSync(path.join(sources, input.source), 'utf8');
      if (sha256(source) !== input.sha256) throw new Error(`Source changed: ${input.source}`);
      await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white;font-family:Arial,sans-serif;width:800px}#drawing{width:800px;background:white}#drawing svg{display:block;max-width:none!important;width:800px!important;height:auto!important}</style></head><body><div id="drawing"></div></body></html>');
      await page.addScriptTag({ path: mermaidPath });
      const rendered = await page.evaluate(async ({ source, name }) => {
        mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'strict', fontFamily: 'Arial', themeVariables: { fontSize: '16px', primaryColor: '#ffffff', primaryBorderColor: '#777777', primaryTextColor: '#222222', secondaryColor: '#f8f8f8', tertiaryColor: '#ffffff', lineColor: '#555555', clusterBkg: '#fafafa', clusterBorder: '#777777', edgeLabelBackground: '#ffffff' } });
        await mermaid.parse(source);
        const result = await mermaid.render('diagram_' + name.replaceAll('-', '_'), source);
        document.querySelector('#drawing').innerHTML = result.svg;
        const svg = document.querySelector('#drawing svg');
        const viewBox = svg.viewBox.baseVal;
        const height = 800 * viewBox.height / viewBox.width;
        svg.setAttribute('width', '800');
        svg.setAttribute('height', String(height));
        svg.style.maxWidth = 'none';
        svg.style.width = '800px';
        svg.style.height = `${height}px`;
        return { svg: svg.outerHTML, viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }, scaledFontPx: 16 * 800 / viewBox.width, nodeCount: svg.querySelectorAll('g.node').length, edgeCount: svg.querySelectorAll('g.edgePath').length };
      }, { source, name: input.name });
      await page.evaluate(() => document.fonts.ready);
      const image = `${input.name}-800.png`;
      const vector = `${input.name}-800.svg`;
      fs.writeFileSync(path.join(output, vector), rendered.svg);
      await page.locator('#drawing').screenshot({ path: path.join(output, image), timeout: 30000 });
      const box = await page.locator('#drawing').boundingBox();
      report.diagrams.push({ ...input, image, vector, dimensions: box, viewBox: rendered.viewBox, scaledFontPx: rendered.scaledFontPx, nodeCount: rendered.nodeCount, pngSha256: sha256(fs.readFileSync(path.join(output, image))), svgSha256: sha256(rendered.svg), parse: 'passed', visualReview: 'pending' });
      console.log(`${input.name}: 800 x ${Math.ceil(box.height)}, scaled font ${rendered.scaledFontPx.toFixed(1)}px`);
    }
    fs.writeFileSync(path.join(output, 'render-report-v2.json'), JSON.stringify(report, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
