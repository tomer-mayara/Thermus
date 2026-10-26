const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
(async () => {
  const root = process.cwd();
  const report = path.join(root, 'reports/s25-policy');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let name = path.join(root, 'dist', decodeURIComponent(url.pathname));
      if ((await fs.stat(name)).isDirectory()) name = path.join(name, 'index.html');
      const type = name.endsWith('.css') ? 'text/css' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.js') ? 'text/javascript' : 'text/html';
      res.writeHead(200, { 'Content-Type': type }); res.end(await fs.readFile(name));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true});
  const results = [];
  try {
    for (const width of [375, 1280]) {
      const context = await browser.newContext({viewport:{width,height:900},javaScriptEnabled:false,deviceScaleFactor:1});
      for (const name of ['terms', 'privacy']) {
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(`http://127.0.0.1:${server.address().port}/${name}/`, {waitUntil:'networkidle'});
        await page.locator('body').screenshot({path:path.join(report, `${name}-${width}-full.png`)});
        const facts = await page.evaluate(() => {
          const legal = document.querySelector('.legal-content');
          const ids = new Set([...document.querySelectorAll('[id]')].map(n=>n.id));
          const anchors = [...document.querySelectorAll('a[href^="#"]')].map(n=>n.getAttribute('href').slice(1));
          return {title:document.querySelector('h1').innerText, text:legal.innerText, version:legal.dataset.documentVersion, sha256:legal.dataset.documentSha256, h1Count:document.querySelectorAll('h1').length,
            allAnchorsResolve:anchors.every(id=>ids.has(id)), anchorCount:anchors.length, horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth,
            directEmail:[...legal.querySelectorAll('a')].some(n=>n.getAttribute('href')==='mailto:legal@thermus.ai'&&n.innerText==='legal@thermus.ai'),
            footerLinks:[...document.querySelectorAll('footer a')].map(n=>({text:n.innerText,href:n.getAttribute('href')})),
            tableCells:[...legal.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.innerText)),
            pageHeight:document.documentElement.scrollHeight};
        });
        const md = await fs.readFile(`src/content/legal/${name}.md`, 'utf8');
        const sourceText = md.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/^[-] /gm,'').replace(/^\|(?:\s*:?-+:?\s*\|)+\s*$/gm,'').replace(/\*\*|`/g,'').replace(/\|/g,' ').replace(/\s+/g,' ').trim();
        assert.equal(`${facts.title} ${facts.text}`.replace(/\s+/g,' ').trim(),sourceText);
        assert.equal(facts.sha256,crypto.createHash('sha256').update(md).digest('hex'));
        assert.equal(facts.h1Count,1); assert.equal(facts.allAnchorsResolve,true);assert.equal(facts.horizontalOverflow,false);assert.equal(facts.directEmail,true);
        await page.screenshot({path:path.join(report,`${name}-${width}-top.png`)});
        if (name==='terms') {
          await page.locator('h2').filter({hasText:'9. Ending use'}).scrollIntoViewIfNeeded();
          await page.screenshot({path:path.join(report,`${name}-${width}-removal.png`)});
        } else {
          await page.locator('h3').filter({hasText:'Organization audit export and destination settings'}).scrollIntoViewIfNeeded();
          await page.screenshot({path:path.join(report,`${name}-${width}-audit.png`)});
          await page.locator('tr').filter({hasText:'Membership-removal operation record'}).scrollIntoViewIfNeeded();
          await page.screenshot({path:path.join(report,`${name}-${width}-retention.png`)});
        }
        const {text,...summary}=facts;
        results.push({name,width,javaScriptEnabled:false,status:response.status(),completeVisibleTextEqualsSource:true,...summary,pageErrors:errors});
        await page.close();
      }
      await context.close();
    }
    await fs.writeFile(path.join(report,'browser-facts.json'),JSON.stringify({checkedAt:new Date().toISOString(),scope:'Local final static build; no deployed preview or production claim',results},null,2)+'\n');
    console.log(JSON.stringify(results.map(({tableCells,...r})=>({...r,tableRows:tableCells.length})),null,2));
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exit(1)});
