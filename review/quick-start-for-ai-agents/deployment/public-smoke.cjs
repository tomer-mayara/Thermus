const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://app.thermus.ai';
const results = [];
async function request(route, method = 'GET') {
  const url = new URL(route, origin);
  if (url.origin !== origin) throw Error('Cross-origin probe refused');
  const response = await fetch(url, { method, redirect: 'manual', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  results.push({ path: url.pathname, method, status: response.status, bytes: Buffer.byteLength(body), contentType: response.headers.get('content-type'), csp: !!response.headers.get('content-security-policy') });
  return { response, body };
}
async function main() {
  const health = await request('/healthz');
  if (health.response.status !== 200 || health.body.trim() !== 'ok') throw Error('Health GET failed');
  const head = await request('/healthz', 'HEAD');
  if (head.response.status !== 200 || head.body !== '') throw Error('Health HEAD failed');
  const portal = await request('/');
  if (portal.response.status !== 200 || !portal.response.headers.get('content-security-policy')) throw Error('Portal failed');
  const assets = [...new Set([...portal.body.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => new URL(m[1], origin)).filter(u => u.origin === origin && u.pathname.startsWith('/assets/')).map(u => u.href))];
  if (!assets.some(u => u.endsWith('.js')) || !assets.some(u => u.endsWith('.css'))) throw Error('Missing built portal assets');
  let quickStartBundle = false;
  for (const asset of assets) {
    const content = await request(asset);
    if (content.response.status !== 200) throw Error('Asset failed');
    if (asset.endsWith('.js')) quickStartBundle ||= content.body.includes('Quick start') && content.body.includes('quick-start');
  }
  if (!quickStartBundle) throw Error('Live portal bundle lacks Quick start');
  const guide = await request('/quick-start');
  if (guide.response.status !== 401 || /<h1[^>]*>Quick start<\/h1>/.test(guide.body)) throw Error('Signed-out guide access was not refused');
  const guideHead = await request('/quick-start', 'HEAD');
  if (guideHead.response.status !== 401 || guideHead.body !== '') throw Error('Signed-out HEAD was not refused');
  const mcp = await request('/mcp');
  if (mcp.response.status !== 401 || !mcp.response.headers.get('www-authenticate')) throw Error('MCP authorization boundary failed');
  const report = { time: new Date().toISOString(), origin, status: 'passed', quickStartBundle, results };
  fs.writeFileSync(path.join(__dirname, 'public-after.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.message); console.log(JSON.stringify(results)); process.exitCode = 1; });
